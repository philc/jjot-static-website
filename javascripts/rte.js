/*
Tricky bits / amazing hacks:
* Rebuild an iframe from stratch after it gets moved around in the DOM (usually after D&D) -- this
*  is because both Mozilla and Safari (and I think Opera) reload the iframe every time it's moved
*  around the DOM tree - https://bugzilla.mozilla.org/show_bug.cgi?id=254144
* Dynamic CSS to prevent server or cache hits, since we rebuild iframes a lot on drag and drop
* Fill up the body of an iframe and turn designmode='on' in the onload of the iframe (for gecko)
*  http://xinha.gogo.co.nz/punbb/viewtopic.php?pid=2113
*  to avoid security exceptions
* If you drag and drop a RTE (or any iframe), your mouse can get caught inside of the iframe
*  and mouse events stop propogating. So we proxy and propogate mouse events from inside the iframes,
*  so you can do fluid drag and
* Ah, the UNDO! You must remember the undo my friend. All operations to the DOM must be done
*  through ranges/selections and the insertHTML command; otherwise, the undo history will just stop working.
* Scrolling - if a note is long and has a scroll bar, when you drag it and recreate the iframe, the scrollbar
*  gets reset to its original position. So you have to save the scrolled value before drag and restore it
*  after drag. There's a weird jumpy drawing bug in mozilla when a note is 1/2 scrolled and you drag it around.
*  It's kind of jarring, but it doesn't affect the functionality and I'm not sure how to fix it.
*  So the workaround is to scroll it to the top while dragging, and after the drag is done, restore the scrollbar
*  to its original position.
* The .editor element must have an element after it -- another child of .editor-parent. Otherwise, IE's insertUnorderedList command
*   (both IE6 and 7) will corrupt the dom tree, shifting a note's titlebar into another DOM element in the tree. Amazing.
*
* body:first-line bugs
* When creating links in Mozilla, if a line is wrapped and you have the body:first-line style enabled,
*  Mozilla will insert zombie links into the text. The workaround for this is astounding; it's in the link editor.
* When inserting something like "[link]&nbsp;" in place of "[link]", mozilla will throw the [link]
*  at the beginning of the document. It's the &nbsp. I don't know how to fix it. I think we need to
*  work around using/avoiding first-line in mozilla, or neglect to use auto-links
*
*
* When you set designMode="on" is important. If you set it after building the contents of the document,
*  IE will load the iframe twice in a row. Strange. If you set it before building the contents of the document,
*  Mozilla will be unable to replace the first selection you make. We've got a test case for this one,
*  and it's filed here: https://bugzilla.mozilla.org/show_bug.cgi?id=379638

* Safari hacks:
*  Doesn't give you a <head> element when you create a new iframe. doc.createElement('head') doesn't work.
*   Fix is to test for presence of head element, and use document.write("<head/><body/>") to create one. [!]
*
* Style sheets:
*  - Safari can't set innerHTML on a style node (throws "DOM exception 7"). Solution:
*    styleNode.appendChild(document.createTextNode(styleText))
*  - IE can't work with style nodes directly (can't insert them into the DOM). Solution:
*     s = document.createStyleSheet(""); s.cssText="..."; // Could also use s.addRule
*/

/* Interesting mozilla bugs:
* https://bugzilla.mozilla.org/show_bug.cgi?id=92686  return inserts line break. Fixed.
* Insert extra lines when hitting enter. https://bugzilla.mozilla.org/show_bug.cgi?id=322202   patchs feb 27
*   might try using execCommand("insertBrOnReturn",false,false) sometime
* Midas won't show anything but a text cursor: https://bugzilla.mozilla.org/show_bug.cgi?id=372345
* In Mozilla, spellcheck triggers over this: <div>title</div>contents
*   filed as: https://bugzilla.mozilla.org/show_bug.cgi?id=382771
* cmd+left on mac goes back in your browser history, instead of to the beginning line in the editor
*   https://bugzilla.mozilla.org/show_bug.cgi?id=289384
*
* The big one: we're waiting for Mozilla to implement contentEditable, so we don't have to jack around with iframes.
*  would hopefully improve performance a lot.
*/

/*
 * Quirks (these are not bugs, so don't try to fix them)
 * If you have an anchor, and try to move inside of it from the line above by pressing the down arrow,
 *  your cursor will not move inside the anchor, but will go to the end of it. By design, apparently.
 */




/*
* Rich text editor initialization and setup
*/

rte={
  /*
  * RTE stylesheet; gets added to all iframe editors
  */
  styleSheet:
  "*{margin:0;padding:0}" +
  "html,body{height:100%}" +
  "body{padding-left:2px;font-family:helvetica,arial,sans; line-height:130%;}" +
  // Necessary for firefox 4 for some reason. Otherwise block elements are... hidden.
  "body, p, div { display:block; }"+
  // should be the same color as the notes. Opera needs this declaration
   // "body{background-color:#fdf7ee; border:0;}"+
  // this is the node title style
  ".title{font-size:1.2em;color:#005eAD; margin-bottom:3px}" +
  // using body:first-line causes serious and subtle bugs in Mozilla.
  // "body:first-line{font-size:1.2em;color:#005eAD;}" +
  // Make links look like they're clickable. Mozilla doesn't show anything but a text cursor
  "a{cursor:pointer ! important}"+
  "a{color:blue;}" +
  "body,html{cursor:text ! important;}"+
  // padding on the links makes them a littl easier to mouseover abd click on
  "a{padding:1px}"+
  // important is needed because of https://bugzilla.mozilla.org/show_bug.cgi?id=374635
  "a:visited{color:#111180 ! important}" +
  "a._mouseover{background-color:#e4eaee;}"+
  "li{margin-left:20px;}"+

  ".ed-search-miss{color:#888;}"+
  ".ed-search-miss div.title{color:#4d7e8a}"+
  ".ed-search-miss a{color:#081a5c}"
  ,


  init:function(){

    // set up the class hierarchy
    rte.Events.implement(new Events);
    rte.Events = new rte.Events();


    rte.Control.implement(new Events);
    rte.Control.implement(new Options);
    rte.Control.implement(new rte.Range.Extension);

    rte.Control.implement(new rte.Links);
    rte.Control.implement(new rte.LinkEditor);

    rte.KeyListeners.init();
    // Create a style element that we can clone and add to the head of all editors.
    // IE doesn't support working with style nodes directly, so this won't be used for IE.
    this.styleSheetNode=this.createStyleSheetNode(rte.styleSheet, "styleSheet");

    // remove all class="mouseoverCLassName" and id="undoBookmark"
    this.cleanupRegex=new RegExp('(class="?'+rte.LinkMenu.mouseoverClassname+'"?)|'+rte.undo.undoNodeID ,"i");
  },
  createStyleSheetNode:function(style, id){
    var s = document.createElement("style");
    s.id=id;
    // IE can't append a child to a styleNode node. innerHTML only works on Mozilla
    if (s.canHaveChildren == false)
      s.text = style;
    else
      s.appendChild(document.createTextNode(style));
    return s;
  },

  replaceTextareas:function(){
    var areas= document.getElementsByTagName('textarea');

    for (var i=0;i<areas.length;i++)
      new rte.newControl(areas[i]);

  },
  /*
   * Attach a rich text editor to the given textarea
   */
  attach:function(id){
    var e = $(id);
    return new rte.newControl(e);
  },
  /* used to detect br tags at the end of strings. Important for reflowing titles, etc. */
  endsWithBR:function(str){
    return str.match(/<br\s*[\/]?>$/i);
  }

};



/*
* Saves relative node positions/offsets of a range, which allows you to rebuild the range, even against a toally new
* DOM (in the case of an undo system or iframe contents reloading)
*/
rte.ClonedRange = new Class({
  initialize:function(range, editor){
    this.editor=editor;
    this.offset = range.startOffset;
    this.nodePosition = new rte.NodePosition(range.startContainer);
  },
  createRange:function(bodyNode){
    var body = bodyNode || this.editor.bodyNode();
    var newNode = this.nodePosition.findMatchingNode(body);
    var range = this.editor.newRange();

    range.setStart(newNode,this.offset);
    range.setEnd(newNode,this.offset);
    return range;
  }
});

/*
* Records a node's relative position to its parents, all the way up to the body node.
* You can use this to see what node the current selection resides in, then create a
* new document tree (e.g. reload the editor's iframe) and find the same node in that
* new iframe by using NodePosition.findMatchingNode(newDocument)
*/
rte.NodePosition = new Class({
  initialize:function(node,options){
    // we don't want to process the <body> node
    if (!node.tagName || node.tagName.toLowerCase()!="body"){
      this.parentOffset = util.dom.indexOfChild(node);
      // body doesn't have a tagname
      if (node.parentNode.tagName && node.parentNode.tagName.toLowerCase()!="body")
        this.parentPosition=new rte.NodePosition(node.parentNode,{child:this, tag:node.parentNode.tagName});
    }

    this.options=options || {};
  },

  findMatchingNode:function(body){
    // go all the way up to the root node, which should be the body node
    var n = this;

    // "this" might be in the middle of the tree. Move up to the root node and crawl down the tree
    // until we hit a leaf (no this.options.child)
    while (n.parentPosition)
      n = n.parentPosition;
    n1=n;
    // log("starting with:",n1);

    var matchingNode = body;
    while (n && n.parentOffset!=null){
      matchingNode = matchingNode.childNodes[n.parentOffset];
      n = n.options.child;
    }
    return matchingNode;
  },
  toString:function(){
    return "tag: "+ this.options.tag + " child: " + (this.options.child ? "yes" : "no");
  }
});

/*
* Used to store the endpoints of a range, so it can be rebuilt later in case the original is changed.
*/
rte.RangeContainer = new Class({
  initialize:function(range){
    this.startContainer=range.startContainer;
    this.endContainer=range.endContainer;
    this.startOffset=range.startOffset;
    this.endOffset=range.endOffset;
  },
  buildRange:function(doc){
    var range = doc.createRange();
    range.setStart(this.startContainer,this.startOffset);
    range.setEnd(this.endContainer,this.endOffset);
    return range;
  },
  log:function(){
    log(this.startContainer,":",this.startOffset,
      this.endContainer, ":",this.endOffset);
  }
  // toString:function(){
  //     var str=[];
  //     return this.startContainer +": " + this.startOffset + "   " +
  //       this.endContainer + ": " + this.endOffset;
  //   }
});

/*
* A single access point that publishes interesting events that happens to any of the rich text editors.
* Subscribe to the mousemove event to catch mouse moves that occur within any rich text editor
* iframes. Some drag and drop implementations need this, so the mouse won't get "lost" inside
* of an iframe and stop transmitting mouse/drag events.
*
* ex: rte.Control.GlobalEvents.addEvent('mousemove',listenerFunction);
*/
rte.Events=new Class({
  initialize:function(){
  }
});


/*
 * Text editing commands, like bold, and italic.
 *
 * Tricky: before executing any commands, we need to focus the editor. Otherwise,
 * if you click somewhere outside of the editor (like a toolbar icon) to trigger
 * the command, the command won't be applied to the intentioned editor, if at all.
 */
rte.Commands=new Class({
  initialize:function(editor){
    this.ed=editor;
  },
  beforeCommand:function(ev){
    // with content editables, the selection needs to be inside the editor for them to work
    this.ed.focus();
  },
  bold:function(){
    this.beforeCommand();

    this.ed.execCommand("bold");
    this.ed.toolbar.determineButtonStates();
    this.ed.checkForChanges();

    return false;
  },
  italic:function(){
    this.beforeCommand();
    this.ed.execCommand("italic");
    // this.ed.toolbar.determineButtonStates();

    this.ed.checkForChanges();
    return false;
  },
  unorderedList:function(ev){
    this.beforeCommand();

    this.ed.execCommand("insertunorderedlist");
    this.ed.toolbar.determineButtonStates();

    this.ed.checkForChanges();
    return false;
  }
});
