/*
* Code for queuing up messages to the server
*/

// NoteTupleArray
Nta = new Class({
	initialize:function(){
		this.ids=[];
		this.data=[];
	},

	set:function(id, data){
		var i = this.ids.indexOf(id);
		if (i == -1) {
			this.ids.push(id);
			this.data.push(data);
		} else {
			this.data[i] = data
		}
	},

	get:function(id){
		var i = this.ids.indexOf(id);
		if (i == -1)
			return null;
		else
			return this.data[i];
	},

	remove:function(id){
		var i = this.ids.indexOf(id);
		if (i != -1) {
			this.ids.splice(i,1);
			this.data.splice(i,1);
		}
	},

	empty:function(){
		return this.ids.length==0;
	}
});  

NoteOperations = new Class({
	initialize:function(){
		this.ntas = ["save", "move", "unmove", "archive", "unarchive", "trash", "untrash"];
		for (var i=0; i<this.ntas.length; i++) {
			var x = this.ntas[i];
			this[x] = new Nta();
		}
		this._saveOrder=false;
	},
	/*
	* true if there are no operations stored in this object
	*/
	empty:function(){
		for (var i=0; i<this.ntas.length; i++) {
			var x = this.ntas[i];
			if (!this[x].empty()) {
				return false;
			}
		}
		return !this._saveOrder;
	},

	// receives a hash of {id:, text:, title:}
	saveNote:function(hash){
		this.save.set(hash.id,hash);
	},
	// receives a hash of {id:, text:, title:, board:}
	moveNote:function(hash){
		if (this.unmove.get(hash.id) == null) {
			this.move.set(hash.id, hash);
		} else {
			this.unmove.remove(hash.id);
		}
	},
	// receives a hash of {id:, text:, title:, board:}
	unmoveNote:function(hash){	
		var id = hash.id;
		if (this.move.get(id) == null) {
			this.unmove.set(id, hash.board);
		} else {
			var noteData = this.move.get(id).note;
			this.move.remove(id);
			Messages.fireEvent("unmove", noteData);
		}
	},
	// receives a hash of {id:, text:, title:}
	archiveNote:function(hash){
		var id = hash.id;
		if (this.unarchive.get(id) == null) {
			this.archive.set(id, hash);
		} else {
			this.unarchive.remove(id);
		}
	},
	// receives a hash of {id:, text:, title:}
	unarchiveNote:function(hash){
		var id = hash.id;
		if (this.archive.get(id) == null) {
			this.unarchive.set(id, id);
		} else {
			var noteData = this.archive.get(id);
			this.archive.remove(id);
			Messages.fireEvent("unarchive", noteData);
		}
	},
	// receives a hash of {id:, text:, title:}
	trashNote:function(hash){
		var id = hash.id;
		if (this.untrash.get(id) == null) {
			this.trash.set(id, hash);
		} else {
			this.untrash.remove(id);
		}
	},
	// receives a hash of {id: }
	untrashNote:function(hash){
		var id = hash.id;
		if (this.trash.get(id) == null) {
			this.untrash.set(id, id);
		} else {
			// if our note in this.trash doesn't have a .text property, request the note from the server.
			var noteData = this.trash.get(id);
			this.trash.remove(id);
      if (note.text) {
        Messages.fireEvent("untrash", noteData);
      } else {
        this.untrash.set(id, id);
      }
		}
	},
	saveOrder:function(){
		this._saveOrder=true;
	}

});

Messages = new Class({
	// if syncTimer is null, then there is no outstanding request
	// syncTimer lets us check to see if a syncWithServer call is set to be called
	// when a timer expires.  It also lets us stop this timer, which is useful
	// if we want to interrupt the timer, and sync immediately

	syncTimer: null,
	queuedNotes: new NoteOperations(),
	inTransit: null,
	currSleepOnFailure:   2500,  // 2.5 seconds
	syncDelay:            2000,  //   2 seconds
	continuousEditDelay: 10000,  //  10 seconds
	maxRetryDelay:       30000,  //  30 seconds
	firstQueued: null,

	doSync:function(method, hash) {
		// we should never be calling this method when Page.shared, 
		// but just in case something slips through, avoid looking like we're saving
		if (Page.shared) return;
		
		method = method + "Note";
		this.queuedNotes[method](hash);
		Messages.queueSend();
	},
	saveOrder:function(){
		this.queuedNotes.saveOrder();
		Messages.queueSend();
	},

	/*
	* Designates that some change is queued up to be saved during the next request we send to the server
	*/
	queueSend:function(){
		// Don't send to the server when we're in demo mode?
		if (Page.demo || Debug.getPref("saveChanges")==false)
			return;

    if (!this.queuedNotes.move.empty() ||
        !this.queuedNotes.unarchive.empty() ||
        !this.queuedNotes.untrash.empty()) {
      theDelay = 10;  // 10 ms, essentially immediately
    } else {
      theDelay = this.syncDelay;
    }
    
		Messages.showSaveStatus();

		if (this.syncTimer == null) {
			// no pending sync operation
			this.syncTimer = Messages.syncWithServer.delay(theDelay, this);
			var d = new Date();
			this.firstQueued = d.getTime();
		} else if (this.inTransit == null) {
			// there is no Ajax request currently out
			var d = new Date();

			// if the user made more changes before the previous changes were sent out to be synced,
			// then delay the sync, up to a maximum of continuousEditDelay+syncDelay seconds
			if (d.getTime() - this.firstQueued < this.continuousEditDelay) {
				$clear(this.syncTimer);
				this.syncTimer = Messages.syncWithServer.delay(theDelay, this);
			}
		}	
	},

	syncWithServer:function(){
		if (this.inTransit == null) {
			// this is not a retry.
			// reset currSleepOnFailure to 2.5 seconds
			this.currSleepOnFailure = 2500;
			this.inTransit = this.queuedNotes;
		} else if (!this.queuedNotes.empty()) {
			// this is a retry
			// we grab any queuedNotes that didn't make it into our last attempt to save
			var queue = this.queuedNotes;
			for (var i=0; i<queue.ntas.length; i++) {
				var x = queue.ntas[i];
				var method = x + "Note";
				for (var j=0; j<queue[x].data.length; j++) {
					var y = queue[x].data[j];
					this.inTransit[method](y);
				}
			}

			if (this.queuedNotes._saveOrder == true)
				this.inTransit._saveOrder = true;
		}

		// Now that we've copied over the notes, we get rid of the reference in queuedNotes
		this.queuedNotes = new NoteOperations();

		this.showSaveStatus();
		this.sendSyncRequest();
	},

	packsave:function(id, note){
		return {
			id:id,
			text:note.text,
			title:note.title
		};
	},
	packmove:function(id, hash){
		return {
			id:id,
			board:hash.board
		};
	},
	packunmove:function(id, board){
		return {
			id:id,
			board:board
		};
	},
	packarchive:function(id, note){
		return id;
	},
	packunarchive:function(id, dummy_id){
		return id;
	},
	packtrash:function(id, note){
		return id;
	},
	packuntrash:function(id, dummy_id){
		return id;
	},

	/*
	*  Builds a sync request and sends it
	*/
	sendSyncRequest:function(){
		var postBody = {};
		postBody.boardNumber=Page.boardNumber;

		var trans = this.inTransit;
		// Get the order of the notes.  If a note was trashed, then it won't appear here
		if (trans._saveOrder)
			postBody.order = Notes.noteIds();

		for (var i=0; i<trans.ntas.length; i++) {
			var x = trans.ntas[i];
			if (!trans[x].empty()) {
				postBody[x] = [];
				for (var j=0; j<trans[x].ids.length; j++) {
					var id = trans[x].ids[j];
					var data = trans[x].data[j];
					postBody[x].push(Messages["pack"+x](id, data));
				}
			}
		}

		// pb=postBody.notes;
		// log(Json.toString(postBody));

		var a = new Ajax("/" + Page.boardOwner + "/" + Page.boardNumber + "/" + "sync",{
			method:'post',
			postBody:Json.toString(postBody),

			// on success, we set syncTimer to null to signal that there's no longer an outstanding request
			// we also set inTransit to null since there are none anymore
			// we check queuedNotes to see if state changes occurred while the Ajax request was being made, and if so we initiate a new save
			onSuccess:function(response){
				// Part of an ugly hack to include last save time
				var lastSave = $('last-save');
				if (lastSave) {
                        	        lastSave.innerHTML = (new Date()).getTime();
                                }

				Messages.syncTimer = Messages.inTransit = null; 
				if (!Messages.queuedNotes.empty()) 
					Messages.queueSend();
				Messages.showSaveStatus();

				// rails returns a single space, for safari compatibility
				if (response=="" || response==" ")
					return;
				var data = eval( '(' + response + ')');

				var undoActions = ["unmove", "unarchive", "untrash"];
				for (var i=0; i<undoActions.length; i++) {
					var x = undoActions[i];
					if (data[x]) {
						for (var j=0; j<data[x].length; j++) {
							var y = data[x][j];
							Messages.fireEvent(x, y);
						}
					}
				}
			},
			onFailure:function(){
				Messages.currSleepOnFailure = Math.round(Messages.currSleepOnFailure * 1.5); 
				if (Messages.currSleepOnFailure > this.maxRetryDelay) 
					Messages.currSleepOnFailure = this.maxRetryDelay; 
				Messages.syncTimer = Messages.syncWithServer.delay(Messages.currSleepOnFailure, Messages);
			}
		});
		a.request();
	},
	showSaveStatus:function(currentlySaving){
		if (this.inTransit)
			Page.showSaveStatus(Page.saveStatus.saving);
		else if (!this.queuedNotes.empty())
			Page.showSaveStatus(Page.saveStatus.unsaved);
		else
			Page.showSaveStatus(Page.saveStatus.saved);
	}
});
Messages.implement(new Events);
Messages = new Messages();	//singleton
