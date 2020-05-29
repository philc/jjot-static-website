/*
 * This is the javascript for the popout.rhtml page, which displays a single note 
 * popped out into its own window.
 
 */

/*
 * Popouts save their status (opened) with a timestamp to a cookie every 20 seconds.
 *
 * window.listeners should contain all of the noteboard windows that are listening
 * for this popout to close.
 * window.noteData contains the note's data if the note is from a demo board (i.e. note saved).
 */
Popout={
	init:function(){
		// add ourselves into the cookie. The noteboards themselves do this, but this might
		// be necessary if the popup window was reloaded, because the onunload handler would have
		// remove this popout from the cookie
		Notes.savePopoutState(Page.noteId,true);
		Notes.overflowContainer = $(document.body);
		
		// tell him that we're now popped out, in the case of a page reload
		if (Page.isJjotWindow(window.opener)){
			window.listeners = window.listeners || [window.opener];
			// this.addListener(window.opener);	
			window.opener.Notes.popout(Page.noteId, Page.user, Page.boardNumber);
		}

		// log=console.log;
		ModalDialog.init();
		
		rte.init();

		Debug = {out:function(){}, getPref:function(){}};
		
		// we need to save our popout-state to the cookie, with a timestamp,
		// every 30 seconds or so. See top of note.popout.js for details as to why
		var f = function(){
			// log("saving on timer");
			Notes.savePopoutState(Page.noteId,true);
		};
		f.periodical(1000*20);
			
		var el = $$('.note')[0];
		
		// demoNoteData is non-null only if we're popping out a note from a demo noteboard
		if (window.demoNoteData){
			$E('textarea').value = window.demoNoteData.text;
			document.title = window.demoNoteData.title + " - Jjot";
		}
		
		var maximized = ViewPreferences.maximizedNoteIds()[Page.noteId];
		
		var n = this.note = new Note(el, maximized);
		
		n.addEvent("maximize",function(){
			var s = window.getSize().size;

			// either double the dimensions if maximizing, or shrink them by 1/2
			var m = n.maximized ? 2 : 0.5;
			
			s.x *= m; 
			s.y *= m;

			// IE's resizeTo method means "resize the *window*, not the document, to be this exact size."
			// So we've got to account for toolbar heights. There's no non-standard way to do this,
			// so using some approximations. We need to account for just the titlebar, since toolbars are hidden.
			if (window.ie || window.webkit){
				s.x += 13;
				s.y += 40;
			}
			window.resizeTo(s.x,s.y);

		});
	
		$(window).addEvent('resize', Popout.resizeNote.bind(Popout));
		this.resizeNote();

		n.editor.executeWhenReady(n.editor.focus.bind(n.editor));
		
		window.onbeforeunload = function(){
			// log("before unload"); 
			// cache this, because the data isn't available in the unload handler.
			Popout.noteData = Popout.note.getNoteData();
			if (Messages.syncTimer != null) 
				return "This note has not been saved; do you still want to close it?";			
		};

		window.onunload = this.beforeUnload.bind(this);
		
		// IE won't let us use window.close.bind(window) here.
		n.element.getElementsBySelector('.close')[0].onclick = function(){window.close();};
	},
	resizeNote:function(){
		var h = window.getHeight();
		$E('.note').style.height = h + "px";
		$E('.editor').style.height = $E('.editor-parent').style.height = h - $E('.titlebar').getHeight() - 5 + "px";
	},
	beforeUnload:function(){
		// note that you can't use console.log in this function; only alerts.
		// If any child methods in this function call log(), this method will fail silently, so beware.
		Notes.savePopoutState(Page.noteId,false);

		var saved = Messages.syncTimer == null;

		if (!window.listeners) return;

		// This code can fail in IE with "can't execute code from a freed script"
		// Not sure under exactly which conditions.
		try{
			window.listeners.each(function(w){

				if (Page.isJjotWindow(w)){
					// alert("got js window");
					w.Notes.unpopout(Page.noteId, {username: Page.user, 
						boardNumber: Page.boardNumber, 
						closeWindow:false,
						noteData:Popout.noteData,
						saved:saved,
						maximized: Popout.note.maximized
					});
				}
			});
		}catch(e){		
		}

	},
	addListener:function(w){
		if (!window.listeners.contains(w))
			window.listeners.push(w);
	}
};

$(window).addEvent('domready',Popout.init.bind(Popout));