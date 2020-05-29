/*
* Drag and drop reordering of notes.
* Also includes dragging a note onto another noteboard
*
* Tricky bits:
*   We have cursor=hand on the drag handle's :hover CSS style. Hoewver, while dragging if you're fast you can
*    move your cursour outside of the titlebar and it will change to an arrow, before the titlebar can catch up.
*    So we'll set the document's cursor to be a hand, so you can't tell that the titlebar is slow in catching up. Looks great.
*
*  We're showing an invisible overlay on top of the iframe of the note we're dragging. This is so we don't have to
*   proxy mousemove events relative to that iframe -- just iframes that we're dragging our note on top of.
*   This is beacuse if we proxy those events, there can be erratic jerking while dragging around quickly while the window
*   is scrolled, at least in Mozilla. I think Mozilla mis-reports the coordinates of the mouse, firing mouseover events
*   on the iframe when the mouse isn't really over the iframe. Using an overlay on top of the note obviates the issue
*   and makes dragging very smooth with no erratic jumps.
*/
var DD = {	
	droppableOptions:{
		
		over:function(el){
			// If the ghost element was hidden, it's because we were hovering over the noteboards list.
			// Sometimes you can move out of the noteboard area (quickly) and into the main area before
			// the ghost element is made visible again. If that be the case, then we're moving left
			// to right, and so the most likely correct thing to do is inject the ghost element to
			// the left of this element

			// log(el.id, "is hovering over",this.id);
			var gh=$(DD.ghostElement);
			if (gh.style.display=="none")
				gh.injectBefore(this);			
			else if (DD.ghostOccursBefore(this))
				gh.injectAfter(this);
			else
				gh.injectBefore(this);			
		},
		leave:function(el){
		},
		drop:function(el, drag){
		}
	},

	draggableOptions:{
		onBeforeStart: function(el) {	
			var dragged =this.element;

			// While dragging, if they move their mouse out of the browser, let go,
			// and then come back in and click to end the drag, a new one can get
			// started. Prevent that.
			if (dragged.style.position=="absolute"){
				this.options.canceled=true;
				return;
			}

			console.log("drag has begun for element " + dragged.id);

			// dragged.applyRule(".dragging");
			dragged.addClass("dragging");

			var textArea = dragged.getElementsByTagName("textarea")[0];
			textArea.editor.beforeDrag();
			textArea.editor.focus();
			
			// don't drag around huge maximiezed notes
			// this needs some more work; we need to "move" the note under the user's cursor
			// if (dragged.hasClass("maximized")){
			// 	dragged.maximizeWhenDone=true;				
			// 	dragged.removeClass("maximized");
			// }else
			// 	dragged.maximizeWhenDone=false;
			
			var overflown=[$('note-scroll')];			
			var top,left;
			
			// IE7 doesn't use an overflown calculation. Just straight up.
			if (window.ie){
				top = dragged.getTop() - Notes.overflowContainer.getTop();	
				left = dragged.getLeft() - Notes.overflowContainer.getLeft();
			}else{
				top = dragged.getTop(overflown);
				left = dragged.getLeft(overflown);
			}
			
			var size = dragged.getSize().size;

			DD.ghostElement.show();	// ghost element can be hidden, if the last note was dragged to a noteboard

			
			// The order here is important. Replace the dragged element, so there's no DOM flicker,
			// then set the dragged element to absolute position and insert it back into the DOM. "Genius!"
			this.element.parentNode.replaceChild(DD.ghostElement, this.element);
			
			dragged.style.left=0;		
		
			dragged.style.position='absolute';

			dragged.style.top = top+"px";
			dragged.style.left = left+"px";

			
			// Setting overflow. See top of file for details.
			if (window.gecko) $E('.b3',dragged).style.overflow="auto";

			dragged.setStyle('width',size.x+"px");	
			// dragged.setStyle('height',size.y);	// don't think this is necessary
			
			// document.body.appendChild(dragged);
			dragged.injectAfter(DD.ghostElement);
			
			// put an overlay across the editor's iframe, so we don't have to proxy drag and drop
			// events from the note's iframe -- just other iframes that we might drag over
			// makes drag and drop a lot smoother, eliminating large erroneous jumps
			if (window.gecko){
				if (!DD.overlay) DD.overlay=new Overlay();
				DD.overlay.show(dragged);
				DD.overlay.overlay.style.background="none";
			}
			
			// Let the window be scrollable
			DD.scroller.start();
			
			// setting the cursor to a hand on document
			// docment.body.style.cursor="move";
			$(document.body).addClass("drag-cursor");
			// $(document.body).applyRule("body.drag-cursor");
		},
		onComplete: function(el) {
			// $(document.body).unapplyRule("body.drag-cursor");
			$(document.body).removeClass("drag-cursor");

			var dragged=this.element;
			console.log("drag has just completed for element " + dragged.id);
			DD.scroller.stop();
			
			if (window.gecko) DD.overlay.remove();

			var textArea = dragged.getElementsByTagName('textarea')[0];
			
			// reset any style changes we might have made
			dragged.removeClass("transparent");								
			dragged.removeClass("dragging");
			// dragged.unapplyRule(".dragging");
			
			// If we've dropped a note onto a noteboard name, we've already removed
			// this note's DOM element from the DOM tree
			if (dragged.moveTo){
				var note = Note.forElement(dragged);
				DD.ghostElement.remove();

				if (dragged.moveTo.number != Page.boardNumber){
					note.moveTo(dragged.moveTo.number, dragged.moveTo.name);
					return;
				}else
					dragged.injectTop($('note-area'));
			}
			
			var p = dragged.parentNode;
			this.element.style.left=0;
			this.element.style.top=0;
			this.element.style.position="relative";
			
			// Reset these to be equal to whatever the class is for them.
			this.element.style.width='';
			this.element.style.height='';
			// if the ghost element is in the current DOM, we should swap places with it.
			// it won't be in the DOM in the event that we dragged a note onto the current noteboard
			// on the left.
			if (DD.ghostElement.parentNode)
				DD.ghostElement.parentNode.replaceChild(this.element,DD.ghostElement);				



			// Setting overflow. See top of file for details.
			if (window.gecko) $E('.b3',dragged).style.overflow="";

			// Save the new order of the list
			Messages.saveOrder();
			textArea.editor.afterDrag();

			return true;
		}
	},

	init:function(){
		// The ghost element moves under an element while it's being dragged.
		this.ghostElement = new Element(document.createElement("div"));
		this.ghostElement.innerHTML="<div></div>";
		this.ghostElement.className="notebox";
		this.ghostElement.id="ghost-element";

		// Scrolling object that we use to scroll the window
		// top area is 100 because that's about where the top toolbar starts
		// DD.scroller= new Scroller($('note-scroll'), {area:30, topArea:100, bottomArea:30, verticalOnly:true});
		DD.scroller= new Scroller(Notes.overflowContainer, {area:30, verticalOnly:true});
		this.setupDragDrop();
		
		// only once
		this.setupNoteboardDropTargets();
	},
	// Checks if the ghostElement occurs in the dom tree before the given element
	ghostOccursBefore:function(element){
		var na = $('note-area');
		var e = na.firstChild;
		while (e.id!=element.id){
			if (e.id=="ghost-element")
				return true;
			e=e.nextSibling;
		}
		return false;
	},
	setupDragDrop:function(){
		var notes= $$('.note');
		var noteboards = $$('#noteboards li');
		var noteboardsContainer = $('noteboards');
		
		// Setup all objects that can be dropped on. Droppables consist of both notes and noteboard list items
		// We're adding the entire #noteboards ol as a droppable. When they mouse over that, we change the note
		// to transparent, so they can see the list of noteboards better.
		var d = notes.slice(0,notes.length);
		
		// TODO: see if this leaks in IE6
		var overflow=[Notes.overflowContainer];
		// all notes have an overflow container; the noteboards do not
		d.each(function(e){e.overflow=overflow;});
		
		d.push(noteboardsContainer);
		DD.draggableOptions.droppables = d.concat(noteboards);
		
		
		DD.draggableOptions.overflown=[Notes.overflowContainer];
		
		notes.each(function(el) { 
			// If this element doesn't already have a drag.Move object associated with it,
			// create one. Otherwise, just update the droppable.
			if (!el.dragObject){
				DD.draggableOptions.handle=el.id+'_drag';
				DD.draggableOptions.editor=el.note.editor;
				el.dragObject=el.makeDraggable(DD.draggableOptions);
				el.addEvents(DD.droppableOptions, true);			
			}else
				el.dragObject.droppables=DD.draggableOptions.droppables;

		});	
	},
	/*
	 * Sets up the noteboard list items on the left to be able ot receive notes.
	 * 
	 * Mozilla has rendering problems where it won't line up items exactly on top of each other -- there may be a 1px
	 * space between elements. This can look bad when we're dragging between noteboards and suddenly we're on top of neither.
	 * Solution is to alter the appearance of the note on a timer. The note is dragged off of a noteboard <li> and onto the #noteboards
	 * Div before that timer can expire, so flicker will never be seen.
	 */
	setupNoteboardDropTargets:function(){
			var noteboards = $$('#noteboards li');
			var noteboardsContainer = $('noteboards');
		
			var noteboardEvents = {
				// Make a note transparent when it hovers over the #noteboards area,
				// so we can see the list of noteboards underneath
				over:function(el){
					// log("over a noteboard", this);
					this.addClass("drag-hover");

					$clear(DD.noteboardDDTimer); 
					DD.dragOverNoteboard(el);
				},
				leave:function(el){
					// log("leaivng a noteboard",this);
					this.removeClass("drag-hover");
					DD.dragLeaveNoteboard(el);
					DD.noteboardDDTimer=DD.dragLeaveNoteboard.delay(100,DD,[el]);
				},
				drop:function(el){
					// sometimes drop events can fire for multiple elements. Should be impossible,
					// but I've seen it happen. Safeguard against this:
					if (!this.hasClass("drag-hover") || !el.parentNode)
						return;

					this.removeClass("drag-hover");

					// Set this property; let the onComplete handler do the actual moving
					var link = $E('.bar',this);
					el.moveTo = {name:link.getAttribute("title"), number:link.getAttribute("number")};
				}
			};

			for (var i=0;i<noteboards.length;i++)
				noteboards[i].addEvents(noteboardEvents,true);

			// TODO: these might leak in IE
			noteboardsContainer.addEvents({
				over:function(el){
					// log("over the noteboards container");
					$clear(DD.noteboardDDTimer);
					DD.dragOverNoteboard(el);
				},
				leave:function(el){
					// log("leaving the noteboards container");
					DD.noteboardDDTimer=DD.dragLeaveNoteboard.delay(70,DD,[el]);
				}
			});
	},
	/*
	* These functions are used to toggle the appearance of a dragged note while it's being dragged over #noteboards.
	* It should be lighter, so you can see the noteboards underneath.
	*/
	dragOverNoteboard:function(el){
		el.addClass("transparent");
		DD.ghostElement.hide();
	},
	dragLeaveNoteboard:function(el){
		el.removeClass("transparent");
		DD.ghostElement.show();
	},
	noteboardDDTimer:0
};
