/*
 * Archived notes panel
 */

Archived={
	// The note data that we build the archived list from. We need an id and a title for each note.
	notes:[],
	currentPage:0,
	pageSize:6,
	
	init:function(){
		this.archivedElement=$('archived');
		this.navLinks=$('archived-nav');
		Messages.addEvent("unarchive",this.unarchive.bind(this));
		this.buildList();
	},
	// invoked from the Messages class.
	unarchive:function(noteData){
		Notes.newNote(noteData.id,noteData.text,{flashEffect:true, saveContents:false});
		this.removeFromArchive(noteData.id);
		// clear the status
		Page.showStatus("");
	},
	/*
	 * Removes a note from the archive
	 */
	removeFromArchive:function(id,animate){
		// If other deletes are still animating, cancel them by rebuilding the list
		if (this.deleteAnimation)
			this.buildList(this.currentPage);
		
		var n = this.noteForID(id);
		
		var whenFinished = function(){
			this.buildList(this.currentPage);
			this.deleteAnimation=null;
		};
		
		this.notes.remove(n);
		var element = $E('#archived a[noteid=' + id +']');
		
		// it might not be in the archive at all, or at least not currently showing
		if (element && animate){
			// Animate the link only, not the parent LI. Since the parent LI is relatively positioned, setting its opacity style
			// attribute causes a 1 pixel movement in Mozilla. Looks retarded.

			this.deleteAnimation=$(element).effect('opacity',{duration:400, onComplete:whenFinished.bind(this)});
			this.deleteAnimation.start(1.0,0);
		}else
			whenFinished.bind(this)();
		
	},
	noteForID:function(id){
		return this.notes.filter(function(e){return e.id==id;})[0];
	},
	/*
	 * When a note title is clicked in the archived list
	 */
	onclick:function(ev){
		ev = new Event(ev);

		Messages.doSync("unarchive",{id:ev.target.getAttribute("noteid")});
		return false;
	},
	listItemHtml:function(id,title){
		return "<li style=''><a class='bar' href='#' noteid='" + id + "' title='" + title.replace(/'/g,"\\'") +"'>" + title + "</a>"+
		"<a href='#' class='delete' title='Delete from archive' " + "></a></li>";
	},
	/*
	 * When one of the trashcans is clicked in the archived list
	 */
	trashcanClick:function(ev){
		ev=new Event(ev);
		// get the noteID of the link that's right before this link in the document
		var noteLink = $(ev.target).getPrevious();
		var data = Archived.noteForID(noteLink.getAttribute("noteid"));
		Notes.deleteNote(data);
		return false;
	},
	buildList:function(page, animateFirst){
		// if we were playing any animations, stop them
		// this.stopDeleteAnimations=true;
		if (this.deleteAnimation)
			this.deleteAnimation.stop();

		page=page || 0;
		
	
		// make sure we can actually display the page given. Sometimes, if entries are removed from the list,
		// we can be stuck displaying a page that has noe ntries
		var maxPage = Math.floor((this.notes.length-1)/this.pageSize);		
		if (maxPage>=0 && page>maxPage) page=maxPage;
		
		var html="";
		
		var start = this.pageSize * page;
		var end = this.pageSize * (page+1);
		if (end > this.notes.length)
			end = this.notes.length;
		
		for (var i=start;i<end;i++){
			var n = this.notes[i];
			// If the title is somehow empty, show "untitled"
			html += this.listItemHtml(n.id, Notes.formatTitleForDisplay(n.title));
		}
		
		this.archivedElement.innerHTML=html;
		
		// Add link handlers
		var links = this.archivedElement.getElementsByTagName("A");
		for (var i=0;i<links.length;i++)
			links[i].onclick= links[i].className=="delete" ? this.trashcanClick : this.onclick;
			
		if (animateFirst){
			var f= $(this.archivedElement.getElementsByTagName('LI')[0]);
			Page.flashEffect(f,"background-color","#ffffff");
			// also do the animatation for the trashcan links
			Page.flashEffect($E('.delete',f),"background-color","#ffffff");
		}
					
		// Show the nav links, but only when we have enough to form multiple pages
		if (this.notes.length>this.pageSize){
			// make sure the nav links stay in the same place on every page.
			// to do this, set the height of the list of items to be pageSize * (height of 1 <LI>)
			var li = $(this.archivedElement.firstChild);
			// IE7 factors in the height of the .delete icon into the list height. Couldn't fix that through CSS
			var height = li.getSize().size.y + (window.ie7 ? 3 : 0) ;
			this.archivedElement.style.height=this.pageSize*height+"px";
			this.buildNavLinks(page);
		}
		else{
			this.archivedElement.style.height="";
			this.navLinks.innerHTML="";
		}
		return false;
	},
	buildNavLinks:function(page){
		
		var prev="&#171;prev";		
		if (page==0)
			prev="<span class='nav unselectable'>"+prev+"</span>";
		else
			prev="<a href='#' class='nav unselectable' onclick='return Archived.prev();'>"+prev+"</a>";

		var next="next&#187;";
		if (this.pageSize * (page+1)<this.notes.length)
			next="<a href='#' class='nav' onclick='return Archived.next();'>"+next+"</a>";
		else
			next="<span class='nav unselectable'>"+next+"</span>";

		this.navLinks.innerHTML=prev+next;

	},
	
	// add:function(noteId, title,text){
	add:function(noteData){

		// don't save the text of the note in the archive (wasted space) unless it's demo account.
		// Then we need it, so we can undo a trashcan click.
		// var noteData = Page.demo ? noteData : {id:noteData.id, title:noteData.title}
		this.notes.unshift(noteData);
		Messages.doSync("archive", noteData);

		this.buildList(this.currentPage,true);

		// Show an undo message
		Page.showStatus("Archived \"" + Notes.formatTitleForDisplay(noteData.title) +"\".", 
			function(){ Messages.doSync("unarchive",{id:noteData.id}); return false;});

	},
	next:function(){
		return Archived.buildList(++Archived.currentPage);
	},
	prev:function(){
		return Archived.buildList(--Archived.currentPage);
	}
	
};
