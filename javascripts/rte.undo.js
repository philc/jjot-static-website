
rte.undo={
	// control char, used for saving selections
	cc: '\u2009',
	bookmark:"SELECTION",
	bookmark:'\u2009',
	undoNodeID:"jj-undobm"
};

rte.undo.Manager=new Class({
	initialize:function(editor){
		this.ed=editor;
		this.stack=[];

		// Don't save selection. You don't want to save selection when initiazing a note in Mozilla,
		// because saving the selection requires focusing that note.
		this.save(0,false);

		this.current=0;
		this.isDirty=false;
	},
	newCursorNode:function(level){
		var span = this.ed.documentNode().createElement("span");
		span.id="rte-undo-"+level;
		span.innerHTML="HI";
		return span;
		// return "<span id='rte-undo-"+level+"'></span>";
	},

	/*
	 * Save an undo state
	 *  selectionRange: optional selection to save. Defaults to wherever the user's current selection caret is.
	 *   Used by the link dialog
	 */
	saveState:function(){
		this.save(++this.current);
		log("saved ",this.current);
	},
	/* the first time the editor gets focused, save user's selection selection.
	  We should probably get saving their new selections as long as they haven't typed anything,
	  But this introduces a bug in mozilla where our bookmarks aren't found by window.find() */
	focused:function(){		
		if (this.focusedOnce || this.isDirty || this.current>0) return;
		// if there is no selection, which can occur while you're dragging around a note in mozilla,
		// don't bother trying to save it
		// var r = this.ed.selectedRange();
		// if (!r) return;

		this.focusedOnce=true;

		this.save(0);
	},
	
	dirty:function(){ this.isDirty=true; },	

	/*
	 * Saves an undo level.
	 *
	 * saveSelection - defaults to true.
	*/
	save:function(level, saveSelection){
		// erase any steps we have after this level; they're no longer relevant
		this.stack.splice(level);
		var undoState={};
		undoState.html = this.editorContents();
		
		if (saveSelection!=false){
			var sel = this.ed.selectedRange();

			// for CE, ensure that the selection is inside the editor		
			if (sel && this.ed.ce){
				// check body node, not editorElement, since dialogs can sit inside the editor
				if (!util.dom.descendsFrom(sel.commonAncestorContainer,this.ed.bodyNode()))
					sel=null;		
			}
			
			if (sel) {
				undoState = this.bookmarkedHTML(sel);
			} else
				log("no valid selection to save during undo");
		}
		
		// this.stack[level]=html;
		this.stack[level]=undoState;
		
		this.isDirty=false;
	},
	 /*
	 * Inserts a marker into the editor's current HTML, saves that HTML, reverts back to the original,
	 * and restores the user's selection.
	 *
	 * Some notes: we actually modify the document by sticking a character at the current selection.
	 *  This means that a text range will probably get split in two. This will jack up any saved ranges 
	 *  we have in Mozilla and IE. IE's workaround is straight forward.
	 *  Midas on the other hand, will flicker the selection cursor back to the beginning of a line
	 *  when you restore a selection after the document has been changed. The only way to get around this
	 *  is to use window.find() to find and select the character we just inserted, delete the selection,
	 *  and then restore our original. Calling normalize is necessary when the original selection
	 *  isn't collapsed; normalize makes the cursor flicker, but you wouldn't notice with a non-collapsed
	 *  range anyway.
	 */
	
	bookmarkedHTML:function(sel){
		if (window.ie) {
			var original = document.selection.createRange();
			var newSel = original.duplicate();

			newSel.collapse(true);
			newSel.text = rte.undo.bookmark;
			newSel.moveStart("character",-rte.undo.bookmark.length);

			html = this.editorContents();
			newSel.select();
			this.ed.execCommand("delete");
			original.select();
			return {html:html,opts:null};
    } else {
      var newDom;
      // cloning this DOM might not be necessary, although in FF2 not cloning this DOm makes the selection off
      // if you create a link and then undo it.
      var saved = new rte.ClonedRange(this.ed.selectedRange(), this.ed);

      if (window.newFirefox) {
        // FF3 needs the element to be in the document tree before making a selection from it.
        var newDom = document.importNode(this.ed.bodyNode(), true);
        newDom.style.display = "none";
        document.body.appendChild(newDom);
      } else {
        var newDom = this.ed.bodyNode().cloneNode(true);
      }

      var r = saved.createRange(newDom);
      
      if (window.newFirefox)
        newDom.parentNode.removeChild(newDom);
      
			var opts = {};
			var sc = r.startContainer;
			if (sc.nodeType==3){
				if (sc.previousSibling){
					sc=sc.previousSibling;
					opts.previousSibling=true;
				}
				else{
					sc=sc.parentNode;
					opts.parentNode=true;
				}
			}
			opts.offset=r.startOffset;
			// log("undo options:",opts);
			sc.id=rte.undo.undoNodeID;
			return {html:newDom.innerHTML,opts:opts};

			var bookmark = this.ed.documentNode().createTextNode(rte.undo.bookmark);
			var saved = new rte.ClonedRange(this.ed.selectedRange(), this.ed);
			var newDom = this.ed.bodyNode().cloneNode(true);
			var r = saved.createRange(newDom);
			r.insertNode(bookmark);
			return newDom.innerHTML;				
			// todo: remove below
			
			
			// If we're restoring a selection that has two endpoints, we need to make sure
			// the document is normalized before we save the selection, and before we restore it.
			if (!sel.collapsed)
				this.ed.bodyNode().normalize();

			sel=this.ed.selectedRange();

			var bookmark = this.ed.cw.document.createTextNode(rte.undo.bookmark);
			var originallyCollapsed = sel.collapsed;

			var savedSelection = new rte.RangeContainer(sel);

			// collapsing the range reduces cursor flicker; at least, it does if we were using range.deleteContents()
			var r = sel.cloneRange();
			r.collapse(true);

			var bookmark = this.ed.documentNode().createTextNode(rte.undo.bookmark);
			r.insertNode(bookmark);				
			html = this.editorContents();

			// Could delete via range. instead, using window.find()
			// r.setEndAfter(bookmark);
			// r.deleteContents();

			if (!originallyCollapsed)
				this.ed.setSelection(r);	// selection has to be collapsed for window.find to work

			if(this.ed.cw.mozFind(rte.undo.bookmark,false,false,true))
				// this.ed.execCommand("delete");
				this.ed.cw.getSelection().deleteFromDocument();	// in this moz only?
			else
				log("!did not find the bookmark we just inserted... find it going backwards?:",
			this.ed.cw.mozFind(rte.undo.bookmark,false,true,true));

			if (originallyCollapsed){
				// if the selection was originally collapsed, textnodes may have been split during insertNode, but we don't
				// care because they can't possibly be in our selection, and our old selection object will work
				this.ed.setSelection(sel);
			}else{
				// we had a word highlighted or something, and doing insertNode probably split up some text nodes.
				// Renormalize, so our document looks like it originally did before the inesrtion, and rebuild the orignal selected range
				this.ed.bodyNode().normalize();	// mm I think this messes things up
				this.ed.setSelection(savedSelection.buildRange(this.ed.documentNode()));
			}
		}
		return html;
	},
	/*
	 * Performs an undo
	 *
	 * Returns true if an undo was performed, false otherwise. 
	 */
	undo:function(){
    log("doing undo");
		// if we're sitting on an undo level, no changes, and they hit undo again,
		// go back one more level
		if (!this.isDirty){
			if (this.current>0)
				this.current--;
			else
				return false;
		}else{
			// if they've made changes after the current level, save that new level,
			// so we can do a redo after this undo if desired
			this.save(this.current+1);
		}
		log("revert to state ", this.current);
		this.ed.bodyNode().innerHTML = this.stack[this.current].html;
		this.restoreSelection(this.current);
		this.ed.attachLinkHandlers();
		this.isDirty=false;
		return true;
	},
	restoreSelection:function(level){
		if (window.ie){
			var r = document.body.createTextRange();
			r.moveToElementText(this.ed.bodyNode());
			if (r.findText(rte.undo.bookmark)){
				// todo: does this need scrolling?
				r.select();
				this.ed.execCommand("delete");
			}
			return;			
		}else{
			var n = this.ed.documentNode().getElementById(rte.undo.undoNodeID);
			// sometimes we don't have a saved selection, which is the case on mozilla's first focus-save
			if (!n)
				return;			
			// log("node with id:",n);
			n.id=null;
			
			var opts = this.stack[level].opts;			
			if (opts.parentNode)
				n=n.firstChild;
			else if (opts.previousSibling)
				n=n.nextSibling;
				
			// log("about to set range on",n, "with offset",opts.offset);
			var r = this.ed.newRangeContaining(n,opts.offset);
			this.ed.setSelection(r);
			
			return;
			
			if(this.ed.cw.mozFind(rte.undo.bookmark))
				this.ed.cw.getSelection().getRangeAt(0).deleteContents();
			// this.ed.setSelection(sel);
			
			// var c = this.getCursorNode(level);
			// // log("got node to replace for id ",this.current,c);
			// 
			// if (!c) return;
			// 
			// $(this.ed.bodyNode()).scrollUntilVisible(c);
			// 
			// var r = this.ed.newRange();
			// r.selectNode(c);
			// this.ed.setSelection(r);
			// 
			// r.deleteContents();	
		}
	},
	/*
	 * The node we embedded in the HTML which indicates where the user's selection caret was,
	 */
	getCursorNode:function(level){
		var id = "rte-undo-"+level;
		return $(this.ed.ce ? this.ed.bodyNode().getElementById(id) : this.ed.documentNode().getElementById(id));
	},
	editorContents:function(){
		return this.ed.bodyNode().innerHTML;
	}, 
	/*
	 * Returns true if a redo was performed, false otherwise.
	 */
	redo:function(){
		if (this.isDirty || this.stack.length<=this.current+1)
			return false;
		this.current++;
		log("restoring level ",this.current);
		this.ed.bodyNode().innerHTML = this.stack[this.current].html;
		this.restoreSelection(this.current);
		this.isDirty=false;
		return true;
	}
	
});

