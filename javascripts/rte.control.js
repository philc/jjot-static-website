/*
* One for each textarea.
*/
rte.Control = new Class({

  initialize: function(textarea){
    this.onMousemove=Class.empty;
    this.onChanged=Class.empty;

    this.textarea=$(textarea);

    // hide text area, insert an .editor control  after it
    this.textarea.setStyle('display','none');

    // Build the titlebar links
    this.titlebar = $('c'+textarea.id+"_buttons");
    this.commands = new rte.Commands(this);

    this.toolbar = new rte.Toolbar(this.titlebar,this);
    this.toolbar.addButtons();

    if (typeof newNoteTimer != "undefined") log("content editable:",((new Date()).getTime()-newNoteTimer)/1000);

    // create the iframe (mozilla) or contentEditable div
    this.createEditorElement();

    this.textarea.editor=this;

    // record how many edit actions we make, so we know when to trigger undos
    this.editActions=0;

    // Safari makes the iframes DOM ready right away, so we can call build iframe right away.
    // Good thing too, because it doesn't support an onload event for iframes.
    // if (window.khtml)
    //   this.iframeLoad();
    // if (window.ie)
    // this.setupControl();


    // if (typeof newNoteTimer != "undefined") log("done init:",((new Date()).getTime()-newNoteTimer)/1000);
  },

  /*
   * Performs one-time initialization tasks on the newly initialized editor control
   */
  setupControl:function(){

    this.attachEvents();
    this.attachLinkHandlers();


    // We could make this assignment in the constructor, but in the textarea,
    // <> are escaped; once design mode kicks in, <> are not escaped.
    // We want to re-assign our content after the browser has parsed it,
    // because it may have changed things around slightly. It may have changed
    // <br/> => <br>, which should not be considered a user-change
    this.textarea.value = this.oldContent = this.bodyNode().innerHTML;

    this.undoManager = new rte.undo.Manager(this);

    // If any functions were waiting to be executed until the editor was ready
    if (this.queuedFunctions){
      this.queuedFunctions.each(function(f){ f(); });
      this.queuedFunctions=[];
    }
  },
  /*
   * Assigns note contents to the editor. Can be used to reinitialize
   * an editor with new contents
   */
  reinitializeContents:function(contents){
    this.textarea.value = this.oldContent = this.bodyNode().innerHTML = contents;
    this.undoManager = new rte.undo.Manager(this);
    this.textarea.title = this.getTitle();
    this.attachLinkHandlers();
  },
  attachEvents:function(){
    var d = this.containerDocument();

    // $(doc) returns false here for some reason. Attach event old fashioned way.
    var keyEvent = this.keyEvent.bindWithEvent(this);
    util.attach(d,'keydown',keyEvent);
    util.attach(d,'keypress',keyEvent);
    util.attach(d,'keyup',this.keyup.bindWithEvent(this));

    util.attach(d,'mouseup',this.toolbar.determineButtonStates.bindAsEventListener(this.toolbar));
    util.attach(d,'focus',this.editorFocused.bindAsEventListener(this));
    util.attach(d,'blur',this.editorBlurred.bindAsEventListener(this));
  },
  /*
   * keydown and keypress handler
   */
  keyEvent:function(ev){
    // if we handle this hotkey, no need to propagate outside the iframe
    if (rte.KeyListeners.runHandlerForKey(ev,this))
      return;

    // propagate hotkeys to the main hotkey manager -- only needed for iframes. Since it's
    // originating from the iframe, delay the call, so we can switch execution contexts
    if (!this.ce && (ev.control || ev.meta))
      Page.Hotkeys.runHandlerForKey.pass([ev],Page.Hotkeys).delay(2);


  },
  /*
   * Listening for keypresses after the fact -- after they've already made changes to the
   * document.
   */
  keyup:function(ev){


    // If all they hit is a meta key, like ctrl, don't respond to that event.
    // It could be really frustrating if they're undoing things one by one,
    // and when they release the control we act on the document and screw up the undo history.
    // So unless they hit a real key of some sort, don't act on it.
    if (ev.code==16 || ev.code==17 || ev.code==18 || ev.code==224)    // shift, ctrl, meta, alt
      return;

    // Do not respond to ctrl Z/shift ctrl Z or ctrl Y (undo and redo)
    if ((ev.key=="z" || ev.key=="y") && (ev.control || ev.meta)){
      // Undo has probably changed something
      // console.log("undo command; ignoring");
    }else if (ev.key!=""){
      // Sometimes we get random stray key events that don't change the DOM, like
      // an extra event after hitting ctrl+z, or arrow keys.

      // Only monitor the doc if the last keystroke really cauased a change in the doc
      // and wasn't an undo command
      if (this.bodyNode().innerHTML!=this.textarea.value){
        this.insertTitleIfMissing();
        // this.checkLinks(ev); // comes from autolink
      }
    }

    this.checkForChanges();
    this.toolbar.determineButtonStates();

    this.fireEvent('keypress',this);
    Debug.out(this.bodyNode(),true);
  },
  /*
   * If the enter key is pressed and we're inside of the title node,
   * then move all of the text after the cursor outside of the title div,
   * and onto the next line.
   * Returns: true if reflow occured, false otherwise (e.g., current selection was not inside the title node)
  */
  reflowTitleNode:function(){
    this.undoManager.saveState();

    var currentRange = this.selectedRange();
    log("reflowing title node");
    // If the current range isn't inside the title node, no reflow need occur
    var titleNode = this.getTitleNode();
    if (! util.dom.descendsFrom(currentRange.startContainer,titleNode))
      return false;

    // Find the titleNode's offset from the body node. Move end of the selection
    // to the node right after titleNode
    var offsetFromBody=util.dom.indexOfChild(titleNode);

    var leftHalfRange = this.newRange();
    leftHalfRange.selectNodeContents(titleNode);
    leftHalfRange.setEnd(currentRange.startContainer,currentRange.startOffset);
    var leftHalf = leftHalfRange.cloneContents();


    var rightRange=this.newRange();
    rightRange.selectNodeContents(titleNode);
    rightRange.setStart(currentRange.startContainer,currentRange.startOffset);
    var rightHalf = rightRange.cloneContents();

    var rightHTML = util.dom.fragmentInnerHTML(rightHalf);

    // IE won't let you insert just an empty <p> node. Make sure it has contents
    // Mozilal needs this too
    if (rightHTML.length==0) rightHTML="<br/>";
    // if (rightHTML.length==0) rightHTML="&nbsp;";

    rightHTML="<p>"+rightHTML+"</p>";

    var newTitle = "<p class='title'>" + util.dom.fragmentInnerHTML(leftHalf) + "</p>" + rightHTML;


    // this is code doing the title change through the DOM. We're using inner HTML
    // because it messes with mozilla's line breaks less... I think. Or it's just more terse.

    // var div = this.documentNode().createElement("div");
    //   var df = this.documentNode().createDocumentFragment();
    //
    //   div.className="title";
    //   div.appendChild(leftHalf);
    //   df.appendChild(div);
    //   df.appendChild(rightHalf);
    //   // log(df);
    //   this.getTitleNode().parentNode.replaceChild(df,getTitleNode());


    this.getTitleNode().remove();
    this.bodyNode().innerHTML = newTitle + this.bodyNode().innerHTML;


    // restore selection. This doesn't make any sense - IE requires you to set the selection
    // inside the title node, not the <p> following the title node. Very funky.
    if (window.ie)
      this.placeCursorInside(this.getTitleNode());
    else
      this.placeCursorInside(this.getTitleNode().nextSibling);
    this.undoManager.saveState();
    this.recentUndo=true;
    this.attachLinkHandlers();  // might have destroyed any links in the title
    this.checkForChanges();

    return true;
  },
  /*
   * Checks for the existence of a title node. If none is there, one is inserted.
   * You should call this both before a keystroke is acted upon by the editor (keypress),
   * in the case of an enter key being pressed and we needing to reflow it,
   * and afterwards (keyup), in the case that they hit ctrl-A and then deleted it.
   */
  insertTitleIfMissing:function(){
    var bodyNode = this.bodyNode();

    // maybe this thing should be getFirst
    var firstChild = bodyNode.firstChild;
    var titleNodes = this.getTitleNodes();

    // make sure we only have one title node in the doc, that it's first, and it's a <p>
    if (firstChild && firstChild.className && firstChild.className.contains("title")
      && firstChild.tagName=="P"  && titleNodes.length==1)
      return;

    // remove any of the bogus titles elsewhere in the document
    for (var i=0;i<titleNodes.length;i++)
      titleNodes[i].removeClass("title");


    if (!firstChild){
      bodyNode.innerHTML="<p class='title'></p>";  // maybe need a space or a <br/> in there?
      this.placeCursorInside(this.getTitleNode());
    }else if (firstChild.tagName=="P"){
      // if the first tag is a paragraph, just add the title to it.
      firstChild.className="title";
    }else if (firstChild.nodeType==3){
      // if the first child is text, go ahead and wrap it in a <p>. Leave everything else alone.
      // Maybe we should also include include elements, but, meh.

      // Take the first line of the editor, and wrap it in a title <p>
      var replacing = firstChild.nodeValue ? firstChild.nodeValue : firstChild.innerHTML;

      // Mozilla doesn't handle an empty container well. Put something inside of it.
      // if we've got nothing to stick inside of it
      if (!replacing) replacing="<br/>";
      // if (!replacing) replacing="&nbsp;";

      var newHTML = "<p class='title'>" + replacing + "</p>";

      bodyNode.removeChild(firstChild);

      bodyNode.innerHTML = newHTML + bodyNode.innerHTML;

      // If it's just a <br> we're inserting, put the selection before it. Otherwise, put it after the text.
      // For some reason, in IE, we can always just put the selection at the beginning of the titlenode and it works fine.
      if (!window.ie){
        var sel;
        if (replacing.match(/^<br\s*\/?>$/)){
          // if (replacing=="&nbsp;"){
          sel = this.newRangeContaining(this.getTitleNode(),0);
        }else{
          // if it's just a <br/> we're inserting, that probably means we did something
          // like ctrl+a, then enter. Put the cursor after the title node in that case.
          // On the other hand, they might just be hitting delete. Need a key to make
          // this logic correct.
          sel = this.selectionAtEndOfNode(this.getTitleNode());
        }

        this.setSelection(sel);
      }else{
        // to be honest, I don't think this branch ever gets hit by IE. I don't think it's
        // possible to have a completely empty note. You're always inside a <p>
        this.placeCursorInside(this.getTitleNode());
      }
    }
  },
  /*
   * This is used when reflowing title nodes. There can be more than one title node
   * if the user has just hit the enter key with their cursor inside the current title node.
   */
  getTitleNodes:function(){
    if (window.newFirefox)
      return $A(this.cw.document.getElementsByClassName('title')).map(function(e) { return $(e); });
    else
      return $ES('.title', this.bodyNode());
  },
  getTitleNode:function(){
    // FF3 documentOwner restriction. Use the editor's document to fetch the title node.
    if (window.newFirefox)
      return $(this.cw.document.getElementsByClassName('title')[0]);
    else
      return $E('.title',this.bodyNode());
  },
  /*
   * Replaces tokens that aren't part of the content, like our special mouseover
   * class on elements.
   */
  cleanupText:function(text){
    // mozilla might have class="jj-mouseover", while IE might have class=jj-mouseover
    return text.replace(rte.cleanupRegex,"");
  },

  /*
   * Get the contents of the editor
   */
  getContents:function(){
    return this.textarea.value;
  },

  checkForChanges:function(){
    // Do not transfer the editor's contents into the text area until any outstanding
    // textarea->iframe assignments have been completed (in the case of Mozilla). This can manifest itself
    // by a note losing its contents if you click the drag bar really fast many times.
    if (!this.editorIsReady())
      return;

    this.textarea.value = this.cleanupText(this.bodyNode().innerHTML);
    this.textarea.title = this.getTitle();


    // this.textarea.value = this.bodyNode().innerHTML;
    if (this.textarea.value!=this.oldContent)
    {
      this.attachLinkHandlers();

      this.editActions++;
      // log("content is different");
      if (this.recentUndo){
        // log("undo was done recently, cancelling");
        this.recentUndo=false;
        this.editActions=0;
      }
      else{
        // after 5 changes to the document, store an undo, unless the changes are really big.
        var diff = Math.abs(this.oldContent.length-this.textarea.value.length);
        // not that much, when you consider length of HTML
        if (diff>50 || this.editActions>7){
          this.undoManager.saveState();
          this.editActions=0;
        }else
          this.undoManager.dirty();
      }

      this.oldContent=this.textarea.value;
      this.fireEvent("changed",this);
    }
  },
  /*
  * To be called before any DOM operations are done to begin a drag
  */
  beforeDrag:function(){
    rte.dragging=true;
    // Save the scroll offset if the note is scrolled some; we scroll the note back to its
    // original only after the drag has finished. See the big bug list (top) for explanation why.

    // this.savedSelection = new rte.SavedSelection(this);

    // this is only for iframe guys
    if (!this.ce){
      this.saveScrollPosition();
      this.checkForChanges();
    }
  },
  afterDrag:function(){
    rte.dragging=false;

    if (window.ie) return;

    // restore our scroll offset, if the note was scrolled when drag began
    this.executeWhenReady(function(){
      this.restoreScrollPosition();
      // if (this.savedSelection)
      // this.savedSelection.restore();
    }.bind(this));

  },
  saveScrollPosition:function(){
    this.savedScrollOffset = [this.cw.pageXOffset,this.cw.pageYOffset];
  },
  restoreScrollPosition:function(){
    this.cw.scrollBy(this.savedScrollOffset[0],this.savedScrollOffset[1]);
    this.savedScrollOffset=null;
  },
  /*
  * returns whether the editor is ready and loaded.
  * the editor might not be ready right away if it's inside an iframe. Takes a few ms to load.
  */
  editorIsReady:function(){
    if (this.ce)
      return true;
    else
      return this.cw && this.cw.document ? true : false;
  },
  editorFocused:function(ev){
    if (!Page.shared)
      this.undoManager.focused();

    this.oldContent = this.textarea.value;
    rte.focusedEditor = this;
    this.fireEvent('focus',this);
    Debug.out(this.bodyNode(),true);
  },
  editorBlurred:function(ev){
    // sometimes the blur event can be called right after we remove the editor from the DOM;
    // bug in mozilla?
    if (!this.editorIsReady())
      return;
    this.checkForChanges();

    rte.focusedEditor=null;
    this.fireEvent('blur',this);

  },
  // We're propogating any mouse moves inside of this iframe to the rest of the page.
  iframeMouseMove:function(ev){
    ev.relativeTo=this.iframe;
    rte.Events.fireEvent('mousemove',ev);
    this.fireEvent('mousemove',ev);
  },
  iframeMouseUp:function(ev){
    ev.relativeTo=this.iframe;
    rte.Events.fireEvent('mouseup',ev);
  },
  iframeClick:function(ev){
    rte.Events.fireEvent('click',ev);
  },
  /*
  * When the iframe load event fires, execute this methods.
  * Usually called e.g. when an rte has just been created, and you want
  * to select all the contents of the rte when it's ready to use.
  */
  executeWhenReady:function(funcs){
    if ($type(funcs)=="function")
      funcs=[funcs];

    this.queuedFunctions=this.queuedFunctions || [];
    this.queuedFunctions=this.queuedFunctions.concat(funcs);

    // if our iframe has already been loaded, which is usually the case
    // with non-mozilla browsers, just execute these immediately
    if (this.editorIsReady()){
      this.queuedFunctions.each(function(f){ f(); });
      this.queuedFunctions=[];
    }
  },
  // Makes the contents of the note a selection
  selectAll:function(){
    var range = this.cw.document.createRange();
    range.selectNodeContents(this.bodyNode());
    this.setSelection(range);
  },
  // Makes the contents of the title a selection
  selectTitleNode:function(){
    if (window.ie){
      var r = document.body.createTextRange();
      r.moveToElementText(this.getTitleNode());
      r.select();
    }else{
      var r = this.newRange();
      r.selectNode(this.getTitleNode().firstChild);
      r.selectNodeContents(this.getTitleNode());
      this.setSelection(r);
    }
  },

  // Puts the focus inside the editor's iframe
  focus:function(){
    if (this.ce)
      this.containerDocument().focus();
    else
      this.cw.focus();
  },

  setSelection:function(newRange){
    if (window.ie)
      newRange._range.select();
    else{
      var selection = this.selection();
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
  },
  selection:function(){
    if (!this.ce)
      return this.cw.getSelection();
    else{
      // Opera also has document.getSelection(), which returns just a string. Don't want that.
      return window.ie ? document.selection : window.getSelection();
    }
  },
  /*
   * The element of this editor that has a .editor class. Div in IE, iframe in Moz
   */
  editorElement:function(){
    return this.ce ? this.div : this.iframe;
  },
  // used for creating elements
  documentNode:function(){
    return this.ce ? document : this.cw.document;
  },
  bodyNode:function(){
    // iframe's document.body, or just the div
    return this.ce ? this.div : this.cw.document.body;
  },
  execCommand:function(commandName, argument){
    var doc = this.ce ? document : this.cw.document;
    if (window.ie && commandName.toLowerCase()=="inserthtml")
      this.selectedRange()._range.pasteHTML(argument);
    else
      doc.execCommand(commandName,false,argument);
  },

  /*
   * top-level object in control of the editor.
   * Use this to assign events
   */
  containerDocument:function(){
    if (this.ce)
      return this.div;
    else
      return this.cw.document;
  },
  selectedRange:function(){
    if (window.ie){
      var sel=document.selection;
      // if this somehow gets called while our cursor is still in a form field,
      // it will throw an exception
        return new rte.Range.IERange(document.selection.createRange());
      try{
        return new rte.Range.IERange(document.selection.createRange());
      }catch(e){
        log("exception returning IERange");
        return null;
      }

      // return new rte.Range.IERange(document.selection.createRange());
    }else{
      var sel = this.selection();
      // can this really throw anything?
      try{ return sel.getRangeAt(0); }
      catch(e){ log("Mozilla exception while calling this.selection().getRangeAt(0)");}
      return null;
    }

    // Safari 2 doesn't support getRangeAt. Can reconstruct it
    // from startNode and endNode

    // If you select text from right to left, the range is backwards.
    // We need to see if we need to switch the order of the ranges
    // Not messing with this until Safari gets better rte support

    // var start = this.newRange(s.anchorNode,s.anchorOffset);
    //   var end = this.newRange(s.focusNode, s.focusOffset);
    //     // return this.newRange(s.anchorNode,s.anchorOffset,s.focusNode,s.focusOffset);
    //   if (start.compareBoundaryPoints(Range.START_TO_START, end)==1){
    //     // selection was made from the right to left. Reverse it.
    //     end.setEnd(s.anchorNode,s.anchorOffset);
    //     return end;
    //   }else{
    //     start.setEnd(s.focusNode,s.focusOffset);
    //     return start;
    //   }


  },
  /*
   * formats the innerHTML of a title node
   */
  formatTitle:function(title){
    var t = title ? rte.util.HTML.scrapeText(title) : "";
    // Clean the title up a bit for display purposes
    return t.replace(/&nbsp;/g," ").trim();
  },

  /*
   * Gets a title string. If there's no blue title, then take the first 40 or so
   * characters of the note.
   */
  getTitle:function(){
    // iframe editor might not be ready. Return cached title.
    if (!this.editorIsReady())
      return this.textarea.title;

    var titleNode = this.getTitleNode();
    return this.formatTitle(
      titleNode ? titleNode.innerHTML : this.bodyNode().innerHTML.substring(0,60));
  },

  /* null any references we have to DOM nodes */
  gc:function(){
    this.div=this.cw=null;
    this.textarea=this.textarea.editor=null;
    this.titlebar=this.commands=null;
    // has a reference to the titlebar node
    // this.toolbar=null;

  }
});

rte.ContentEditableControl = rte.Control.extend({
  createEditorElement:function(){
    // mark the fact that this editor supports content editable
    this.ce=true;
    var d = $(document.createElement("div"));
    d.className="editor ce";

    d.innerHTML = this.textarea.value;

    // Must have an element after the note object, for IE6/7. See top of file for details.
    // d.injectAfter(this.textarea);
    d.injectBefore(this.textarea);

    // Opera must have this set _after_ the element is in the DOM
    if (!Page.shared)
      d.contentEditable="true";
    this.div = d;

    this.setupControl();
  }
});

rte.IFrameControl = rte.Control.extend({
  createEditorElement:function(){
    this.iframe=new Element(document.createElement("iframe"));
    // this.iframe.setAttribute("domain","localhost");
    this.iframe.className="editor";
    this.iframe.id=this.textarea.id+"_if";
    // this.iframe.location="#";
    this.cw=null;

    this.iframe.addEvent('load',this.iframeLoad.bindAsEventListener(this));

    this.iframe.injectBefore(this.textarea);
  },
  /* gets called every time out iframe loads */
  iframeLoad:function(){
    // if (typeof newNoteTimer != "undefined") log("iframe load:",((new Date()).getTime()-newNoteTimer)/1000);

    if (!this.buildIframe()) {
      log("was not able to build iframe");
      return;
    }
  },
  /*
  * Builds/rebuilds the iframe from scratch
  */
  buildIframe:function(){
    doc = this.iframe.contentWindow.document;

    var body = $(this.iframe.contentWindow.document.body);
    // Turn off firefox's spellcheck, because it has issues
    body.spellcheck = false;
    this.cw = this.iframe.contentWindow;

    var head = doc.getElementsByTagName("head")[0];

    // this is needed for FF3; not supported in FF2
    if (window.newFirefox)
      head.appendChild(doc.adoptNode(rte.styleSheetNode.cloneNode(true)));
    else
      head.appendChild(rte.styleSheetNode.cloneNode(true));

    this.cw.log = console.log;
    // TODO: this is throwing security exceptions. We mignt no longer need it for undo.
    // Sheer brilliance. We can't access the window.find function of the iframe (which
    // we use for saving selections), so we'll make an alias to the function using
    // a script node from within the iframe

    var d = doc.createElement("script");
    d.innerHTML="window.mozFind=function(){try{window.find('hey')}catch(e){log(e);}};"
    head.appendChild(d);


    body.innerHTML = this.textarea.value;

    doc.designMode="on";

    // Add our mouseMove event. Only applies to iframes
    body.addEvent('mousemove',this.iframeMouseMove.bindAsEventListener(this));
    body.addEvent('click',this.iframeClick);
    body.addEvent('mouseup',this.iframeMouseUp.bindAsEventListener(this));

    // After we're done building the iframe, finish the rest of the setup
    this.setupControl();

    if (Page.shared) this.execCommand("contentReadOnly");
    this.execCommand("insertBrOnReturn", false);

    // Debug.out(this.bodyNode(),true);
    return true;
  }
});

rte.newControl=function(textarea){
  // Before firefox 3, we couldn't use contentEditable.
  // with firefox3, is document.body.contentEditable no longer nil, it's "inherit".
  // TODO: enable this when you have time to test it
  // if (window.gecko && !document.body.contentEditable)
  if (window.gecko)
    return new rte.IFrameControl(textarea);
  else
    return new rte.ContentEditableControl(textarea);
};


rte.KeyListeners={
  /*
   * Sets up the key listeners that apply to all notes
   */
  init:function(){
    this.keydown = {};
    this.keypress = {};

    var add = this.add.bind(this);
    var kd="keydown";
    var kp="keypress";

    add(kd,"tab", this.switchNote);
    add(kd,"shift_tab", this.switchNote);

    if (Page.shared){
      // cancel this keypress. It removes selected content in moz for some reason,
      // which we don't want to allow on read-only pages
      add(kd,"ctrl_k",function(){});
      return;
    }

    /*
     * keydown events - mostly shortcuts
     */
    // two shortcuts for link
    add(kd,"ctrl_k",this.link);
    add(kd,"ctrl_l",this.link);

    add(kd,"ctrl_y",this.redo);

    // Allow ctrl+z to work on macs. Will not propagating this screw with pcs?
    add(kd,"ctrl_z",this.ctrlZ);
    add(kd,"ctrl_shift_z",this.ctrlZ);

    // Mozilla (or is it OSX?) does some weird "grow the font size" editor command.
    // Don't let it do that crap. Instead, invoke redo

    add(kd,"meta_z",this.ctrlZ);
    add(kd,"meta_shift_z",this.ctrlZ);
    /*
     * keypress events
     */
    add(kp,"enter",this.enter,{cancel:false});
    add(kp,"up",this.up, {cancel:false});


    // ctrl+~ for tabbing. `~ key doesn't work in IE. It shows up as an à
    // if (window.ie)
    //   add(kd,"ctrl_à",this.switchNote);
    // else
    //   add(kd,"ctrl_`",this.switchNote);

    if (!window.webkit)
    {
      // capture keydown
      add(kd,"ctrl_b",function(){rte.focusedEditor.commands.bold();});
      add(kd,"ctrl_i",function(){rte.focusedEditor.commands.italic();});
      add(kd,"ctrl_u",function(){rte.focusedEditor.commands.unorderedList();});
    }
  },
  ctrlZ:function(ev,ed){
    if (ev.shift)
      rte.KeyListeners.redo(ev,ed);
    else
      rte.KeyListeners.undo(ev,ed);
  },
  undo:function(ev,ed){
    if (ed.undoManager.undo())
      ed.recentUndo=true;
  },
  redo:function(ev,ed){
    if (ed.undoManager.redo())
      ed.recentUndo=true;
  },

  link:function(ev,ed){ ed.toolbarLink();  },
  // search uses a method like this. We could probably use that/combine them
  switchNote:function(ev,ed){
    var el = ed.textarea.note.element;
    var n = ev.shift ? el.getPrevious() : el.getNext();
    // If there's no "next", or the element doesn't have a note (there's a <br/>
    // tag sitting in there, wrap around to the first/last
    if (!n || !n.note){
      var na = $('note-area');
      // last element is the <br/>
      n = ev.shift ? na.getLast().getPrevious(): na.getFirst();
    }
    // IE's scrolling is too jumpy to do 100ms
    n.note.scrollIntoView(window.ie ? 0 : 100);
    n.note.focus(true);

  },
  bold:function(ev,ed){ ed.commands.bold(); },

  up:function(ev,ed){
    // I think this fix only applies to Mozilla. IE doesn't need it.
    // if we're inside the title node, _and_ the title node is the first thing in the document,
    // prevent the cursor from moving "before" the title node (when they hit up arrow)
    var previous = ed.getTitleNode().previousSibling;

    var noSibling = !previous || ($type(previous)=="whitespace" && !previous.previousSibling);
    if (noSibling && util.dom.descendsFrom(ed.selectedRange().startContainer, ed.getTitleNode())){
      ed.setSelection(ed.newRangeContaining(ed.getTitleNode(),0));
      ev.stop();
    }
  },
  /*
  * If we hit enter while in the title node, split the title node in half
   */
  enter:function(ev,ed){
    ed.insertTitleIfMissing();  //todo
    if (ed.reflowTitleNode())
      ev.stop();
  }
};

rte.KeyListeners = $extend(rte.KeyListeners,HotkeyManager);

/*
* Toolbar buttons and actions for an editor.
*/
rte.Toolbar = new Class({
  initialize:function(titlebar,editor){
    this.editor=editor;
    this.titlebar=$(titlebar);
  },
  addButtons:function(){
    // Find bold link
    this.bold = this.titlebar.getElementsBySelector(".bold")[0];
    this.bold.title="Bold "+this.hotkeyString("B");

    this.link = this.titlebar.getElementsBySelector(".link")[0];
    this.link.title="Create link "+this.hotkeyString("K");

    this.bullets = this.titlebar.getElementsBySelector(".bullets")[0];
    this.bullets.title="Create bulleted list "+this.hotkeyString("U");

    if (window.webkit) {
      // These buttons just do not work in webkit. In fact, inserting bullets will crash Chrome 5.
      this.bold.setStyle('display','none');
      this.link.setStyle('display','none');
      this.bullets.setStyle('display','none');
      return;
    }

    if (!Page.shared){
      this.link.onclick = this.editor.toolbarLink.bind(this.editor);
      this.bold.onclick = this.editor.commands.bold.bind(this.editor.commands);
      this.bullets.onclick = this.editor.commands.unorderedList.bind(this.editor.commands);
    }else
      this.link.onclick = this.bold.onclick = this.bullets.onclick = function(){return false;};

    GC.run(this.gc.bind(this));
  },
  hotkeyString:function(c){
    // for now, have everyone using ctrl+
    // var str = (window.OS=="MacOS") ? "⌘"+c : "Ctrl" + "+" + c;
    var str = "Ctrl" + "+" + c;
    return "(" +str+ ")";
  },
  toggled:function(button){
    var button = $('c'+this.editor.textarea.id+'_'+button);
    return button.hasClass('on');
  },
  setChecked:function(button,state){
    var button = $('c'+this.editor.textarea.id+'_'+button);
    if (!button.hasClass('on'))
      button.addClass('on');
  },

  // Determines what buttons to enable based on the current selection
  determineButtonStates:function(){
    // log("determining button states");

    // Using the IE DOM-range compat layer here is too slow.
    var parent;
    if (window.ie){
      var sel = this.editor.selection();
      // TODO: return if the selection doesn't descend from the current editor?
      var range = sel.createRange();
      try{  parent = range.parentElement();    }catch (e){ return false;  }

    }else{
      var range = this.editor.selectedRange();
      if (!range) return;
      parent = range.commonAncestorContainer;
      parent = parent.parentNode;
    }

    var children = this.titlebar.childNodes;
    $(this.titlebar).getChildren().each(function(child){
      if (child.hasClass('on'))
        child.removeClass('on');
    });

    var d = this.editor.documentNode();

    if (d.queryCommandState('bold'))
      $(this.bold).addClass('on');

    if (d.queryCommandState('unlink'))
      $(this.link).addClass('on');

    if (parent && rte.util.Node.findParentWithTag(parent,"A", this.editor.editorElement()))
      $(this.link).addClass('on');

    return;


    // For now, no need to do any of this, afaik. queryCommandState seems to work pretty well
    // selection for IE
    if (this.editor.iframe.contentWindow.document.selection)
    {
      selection = this.editor.selection();
      range = selection.createRange();
      try{
        parent = range.parentElement();
      }catch (e){
        return false;
      }
    }
    // everybody else
    else
    {
      try{
        selection = this.editor.selection();
      }catch (e){
        console.log("exception: ",e);
        return false;
      }
      range = selection.getRangeAt(0);
      if (!range.commonAncestorContainer)
        log("!!no ancestor container");
      log(range);
      //console.log("ancestor container:",range.commonAncestorContainer);
      parent=range.commonAncestorContainer;
      //console.log(range);
      //console.log(parent);
      //console.log(parent.childNodes);
    }


    // Walk up the tree, processing which styles are enabled

    // Start by skipping any text nodes
    while (parent.nodeType == 3){
      parent = parent.parentNode;
    }

    /*    console.log("parent.nodename:" + parent.nodeName);*/
    while (parent.nodeName.toLowerCase() != "body"){
      /*      console.log("checking ",parent);*/
      switch (parent.nodeName.toLowerCase()){
        case "span":
        if (parent.getAttribute("style").test("font-weight: bold;")){
          /*            console.log("selection is bolded.");*/
          this.setChecked('bold',true);
        }
        break;
      }
      parent=parent.parentNode;
    }

  },
  gc:function(){
    this.titlebar=this.bold=this.link=this.bullets=null;
  }



});
