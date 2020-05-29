/* 
 * Implements the popout support for notes.
 * 
 * Need to document:
 * Maximization states
 * cookies store, in seconds
 * crashing case
 */

$extend(Notes,{
	poppedOut:{},
	popoutMap:{},

	/*
	 * Sets up the timers to check cookies eveyr few seconds to see if something new has been popped out.
	 * called from ui.js init
	 */
	popoutInit:function(){
		this.checkPopouts();
		this.checkPopouts.periodical(1000*5,this);
	},
	savePopoutState:function(id, poppedOut){
		var a = ViewPreferences.getPreference("poppedOut") || {};
		if (poppedOut)
			a[id] = util.timeInSeconds();
		else
			delete a[id];

		ViewPreferences.setPreference("poppedOut",a);
	},
	checkPopouts:function(){
		if (Notes.popoutLock) return;
		var a = ViewPreferences.getPreference("poppedOut") || {};
		// log("checking popouts. Got:",a, "compared to",this.poppedOut);

		var keys = util.keys(a);

		for (var id in a){
			if (!this.poppedOut[id]){
				// if it's a stale cookie due to browser crash, don't try and open it. Remove it from the cookie.
				if ((util.timeInSeconds()-a[id])<30)
					Notes.popout(id);
				else
					delete a[id];
			}
		}

		for (var id in this.poppedOut)
			if (!a[id]) Notes.unpopout(id, {closeWindow:false});

		// if we made changes to the preferences, save them
		if (keys.length != util.keys(a).length)
			ViewPreferences.setPreference("poppedOut");

		this.poppedOut = a;
		// log("done checking");
	},
	popout:function(id, username, boardNumber){
		if (username && boardNumber && (username != Page.user || boardNumber != Page.boardNumber))
			return;
			
		log("popping out from Notes",id);	
			
		// Establish a lock: window.open can be an expensive call. Don't want checkPopouts 
		// on a timer to come along and try and open it twice.
		if (this.poppedOut[id]) return;

		Notes.popoutLock = true;
		var n = $('note'+id);
		if (n){			
			this.poppedOut[id] = util.timeInSeconds();

			this.popoutMap[id] = n.note.popout();

			this.savePopoutState(id,true);
		}
		Notes.popoutLock=false;
	},
	/*
	 * Pops a note back into the page. Popup windows pass in their page credentials, so we don't 
	 * act on windows sending notifications to jjot pages that do not contain the note.
	 *
	 * Options:
	 *  username
	 *  board
	 *  closeWindow - true if you want to close the window. Should be false when called from a popup's unload event.
	 */
	unpopout:function(id, options){
		options = options || {};
		log("unpopping out from Notes",id,options);

		// Don't act on this event if we've got a different noteboard loaded
		if (options.username && options.boardNumber && (options.username != Page.user || options.boardNumber != Page.boardNumber))
			return;


		if (this.poppedOut[id]){
			delete this.poppedOut[id];
			
			// close the window
			var w = this.popoutMap[id];
			if (Page.isJjotWindow(w) && options.closeWindow != false)
				w.close();
			
			delete this.popoutMap[id];
			
			// search for it in our notes
			var n = $('note'+id);
			if (n)
				n.note.unpopout(options);
		}
		Notes.savePopoutState(id,false);		
	}
	
});


$extend(Note.prototype,{
	popoutWindowName:function(){
		return Page.user + "_" + Page.boardNumber + "_" + this.noteId;
	},
	popout:function(){
		var size = this.element.getSize().size;
		log("note popup");
		// Adding a hash onto the end of the URL will prevent the popup's page from refreshing
		// if the window is already opened.
		// Mozilla and IE won't let you hide the status bar, but it's worth a shot.
		var popupWindowArgs = "resizable=yes,status=no,width=" + size.x + ",height=" + (size.y);

		var w = window.open(Page.urlToBoard + "/popout/" + this.noteId + "#", this.popoutWindowName(),popupWindowArgs);
		
		// log("tried to open popup, got:",w, this.popoutWindowName());

		if (w.listeners)
			w.listeners[w.listeners.length] = window;
		else
			w.listeners = [window];

		// The server doesn't have any of demo's data, so put it in the window directly
		if (Page.boardOwner=="demo") w.demoNoteData = this.getNoteData();
		
		this.displayPopupControls();
		return w;
	},
	displayPopupControls:function(){
		// Hide the editor. Don't do display="none", because if we were still initializing the editor via an iframe,
		// designMode can't be established on a hidden element.
		this.editor.editorElement().style.visibility = "hidden";

		if (!this.popoutOverlay) this.popoutOverlay = new Overlay();			
		this.popoutOverlay.show(this.element);

		var d = this.popoutControls = $(document.createElement("div"));

		// positioned like an overlay, but not faded-white.
		d.className = "overlay popout-controls";		
		d.style.position = "absolute";
		d.style.left = 0;
		d.style.top = 0;
		
		d.innerHTML="<div>This note is popped out into another window.<br/><br/>";
		
		var b = document.createElement("button");
		b.innerHTML="Close popped-out window";
		b.onclick = function(){Notes.unpopout(this.noteId, {focus:true});}.bind(this);
		
		d.firstChild.appendChild(b);
		
		this.element.appendChild(d);
	},
	unpopout:function(options){
		log("unpopout out from note");
		// rebuild our local editor from the popout's contents		
		if (options.noteData)
			this.editor.reinitializeContents(options.noteData.text);
						
		// if they didn't save the popout, then we should save it, now that we have its new data
		if (options.saved==false)
			Messages.doSync("save", this.getNoteData());
		
		this.popoutControls.remove();
		this.popoutOverlay.remove();
		
		this.editor.editorElement().style.visibility="";

		// for some reason, at least in firefox, focus needs to be executed in a different thread
		if (options.focus){
			var f = function(){
				this.focus(true);
			}.delay(1,this);
		}
	}
});