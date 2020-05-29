/*
* ui.js
* All of the page level UI, like resizing notes, saving view options, drag and drop
*
* Tricky bits
* Drag drop:
* order of swapping the ghost element when a drag initiated must be precise; otherwise, the DOM will flicker from
*  reflowing the floats
* Instead of changing the display styles of individual notes, change the actual CSS classes themselves
*  and let the browser worry about rendering the global changes quickly.
* Set the overflow style of a note to be "auto" when we start a drag. This prevents the scrollbars of underlying notes from
*  poking through in Mozilla. See top of modalDialog.js for more details. We're not setting overflow:auto in the stylesheet, because
*  a) I think it has performance implications when applied to all notes, and
*  b) when you change the size of notes, we need to manually change the size of the editor iframes in JS,
*     and before our JS runs the scrollbars will show for a second, causing flicker.
*  So we're setting overflow:auto only for the dragged note when a drag starts, and turning it off once the drag is finished.
*
* Browser bugs to be aware of:
*  Firefox autocomplete - in FF 1.5, FF can throw a XUL error if you try and focus a field right after hitting enter
*   in a form. It doesn't mess up our JS execution but there's a big ugly error on the console. Only reference I could find to this bug
*   is here: http://groups.google.ca/group/netscape.public.mozilla.dom/browse_thread/thread/821271ca11a1bdbf/
*   Simple fix for FF 1.5 is to set autocomplete="off" on some form fields, like those of the create-link dialog.
*  IE doesn't release the focus of a link after you click it, so styling a:active can't achieve a "mousedown" style effect.
*   solution is to call this.blur() in the <a>'s onclick
*  mozilla overflow:auto (fixed in FF3)
*   https://bugzilla.mozilla.org/show_bug.cgi?id=167801
*/

var Stylesheets={
  // Cache a reference to the style sheet
  // noteSheet:null,
  init:function(){
    // Find notes.css
    // this.noteSheet=this.findSheet("all_dev.css");
    // if (!this.noteSheet) this.noteSheet = this.findSheet("all_min.css");

    this.rules={
      dragCursor:this.findRule("body.drag-cursor"),
      note:this.findRule(".notebox"),
      editor:this.findRule(".editor"),
      editorParent:this.findRule(".editor-parent"),
      textarea:this.findRule(".note textarea"),
      maximized:this.findRule(".maximized"),
      maximizedEditor:this.findRule(".maximized .editor"),
      maximizedEditorParent:this.findRule(".maximized .editor-parent"),
      ghostElementDiv:this.findRule("#ghost-element div"),
      note_paddingFocused:this.findRule(".focused div.note_padding"),
      b2Focused:this.findRule(".focused .b2"),
      b3Focused:this.findRule(".focused .b3")
    };

    this.rules.notes={
      note_padding:this.findRule('.note_padding'),
      b1:this.findRule('.b1'),
      b2:this.findRule('.b2'),
      b3:this.findRule('.b3'),
      editor:this.findRule('.editor')
    };
  },
  /*
  * Finds all rules matching the given selector text. It might be the case that there
  * are many of them. We need to know about all of them for parseCssText
  */
  findRule:function(selectorText){
    var results=[];
    $A(document.styleSheets).each(function(sheet){
      var rules = sheet.cssRules || sheet.rules; // IE vs. moz
      for (var i=0;i<rules.length;i++)
        if (rules[i].selectorText.toLowerCase() == selectorText)
          results.push(rules[i]);
    });
    return results;
  },
  /* this is used for IE. Find the non-empty style properties of a css rule */
  styleProperties:function(styleRule){
    var style;
    for (k in styleRule){
      var val = styleRule[k];
      if (val!="" && val!=false) style[k]=val;
    }
    // we don't want this attribute
    delete style.cssText;
  },
  /*
   * Converts CSS text like:
   *     border-color : blue;
   *     margin-bottom:2px;
   *
   * into javascript style-compatible hash:
   *     { borderColor:"blue", marginBottom:"2px"}
  */
  parseCssText:function(text){
    var rules = text.split(";");
    var style={};
    rules.each(function(r){
      var pair = r.split(":");
      // change rule names like margin-bottom to marginBottom
      var ruleName = pair[0].trim().toLowerCase().replace(/\-(.)/,function(a,b){ return b.toUpperCase();});
      style[ruleName]=pair[1].trim();
    });
    return style;
  },
  styleObjectForRule:function(selectorText){
    // convert the css plaintext for all rules into a javascrpt style object
    var cssText = this.findRule(selectorText).map(function(r){return r.style.cssText;}).join(';');
    return Stylesheets.parseCssText(cssText);
  }
};


// IE hack for applying style sheets
Element.extend({
  unapplyRule:function(selectorText){
    // In non-IE browsers, this function is equivalent to removeClass. Parse out the classname from the given selector text
    if (!window.ie){
      var className = selectorText.match(/\..*/).last().substring(1);
      this.removeClass(className);
      return;
    }

    // convert the css plaintext for all rules into a javascrpt style object
    var styleObject = Stylesheets.styleObjectForRule(selectorText);

    for (var k in styleObject){
      if (!k.contains("border"))
        this.style[k]="";
      else{
        var attrs = ["borderStyle","borderWidth","borderColor"];
        attrs.each(function(a){this.style[a]="";}.bind(this));
      }
    }
    return;
  },
  applyRule:function(selectorText){
    // In non-IE browsers, this function is equivalent to addClass. Parse out the classname from the given selector text
    if (!window.ie){
      var className = selectorText.match(/\..*/).last().substring(1);  //trim the period off the classname
      this.addClass(className);
      return;
    }
    var styleObject = Stylesheets.styleObjectForRule(selectorText);
    for (var k in styleObject)
      this.style[k]=styleObject[k];
  },
  // TODO: remove these
  applyClass:function(ruleSet){
    // convert the css plaintext for all rules into a javascrpt style object
    var rules = ruleSet.map(function(r){return Stylesheets.parseCssText(r.style.cssText);}).join('\n');
    for (var k in rules)
      this.style[k]=rules[k];
  },
  unapplyClass:function(ruleSet){
    var rules = ruleSet.map(function(r){return Stylesheets.parseCssText(r.style.cssText);}).join('\n');
    for (var k in rules){
      if (!k.contains("border"))
        this.style[k]="";
      else{
        var attrs = ["borderStyle","borderWidth","borderColor"];
        attrs.each(function(a){this.style[a]="";}.bind(this));
      }
    }
  }
});

var Page={
  /*
   * This sets up everything that's needed for the regular note interface
   */
  fullInit:function(){
    log('page.init');

    // dynamically resize the note-area as we resize the browser
    Notes.overflowContainer = window.ie6 ? $('note-area') : $('note-scroll');
    $(window).addEvent('resize',Page.resizeNoteArea);
    this.resizeNoteArea();

    if (Debug)
      Debug.init();

    Stylesheets.init();

    // Get the notes widths set as soon as possible, so there's no visual shift/flicker
    StretchyGrid.init();

    if (!Page.index){
      // don't forget to include query string params (like shared auth tokens) in the url
      var a = new Ajax("/main/content/"+Page.boardOwner + "/" + Page.boardNumber + window.location.search, {
        // this needs to be post, or it can get cached. We don't want it cached.
        method:"post",
        // sending a non-empty post-body, so we don't have a POST request without a content-length header.
        // Mootools itself should fix this sometime.
        // http://forum.mootools.net/viewtopic.php?pid=20400
        postBody:"x",
        onSuccess:function(m){
          // there's probably a better way to do this
          eval(m);
          var br = document.createElement("br");
          br.style.clear = "left";
          $('note-area').appendChild(br);

          Page.onNotesLoaded();

        }
      });
      a.request();
    }else
      Page.onNotesLoaded();

    ModalDialog.init();
    Login.init();


    if ($('share') && Page.demo) {
      $('share').addEvent('click',function(){
        $('search-message').innerHTML =
          "<strong>You must sign in to share noteboards.</strong>";
        return;
      });
    }

  },
  /*
   * Initialization to occur after all notes are loaded
   */
  onNotesLoaded:function(){
    if (!Page.shared)
      Archived.init();

    rte.init();

    Notes.init();

    var maximizedNotes = ViewPreferences.maximizedNoteIds();

    var notes = $$('.note');

    $$('.note').each(function(e){
      var n = new Note(e,maximizedNotes[e.id.substring(5)]);
    });

    Notes.popoutInit();

    // Bug in IE. If we have a note focused, and hit reload, the selection will still be inside that editor but we never
    // get a focused event, so the note isn't "selected." Hotkeys etc. won't work until we clck on the note.
    // Fix is to see if we have a note selected.
    if (window.ie){
      // this is duplicated with rte.control.js "determinebuttonstates." Worth refactoring?
      var el, editorElement, range = document.selection.createRange();

      try{
        el = range.parentElement();
      }catch (e){}
      if (el){
        var noteEl = util.dom.findParentWithClass(el,"note");
        log("got this note element:",noteEl);
        if (noteEl) noteEl.note.focus(true);
      }
    }


    // We need to calculate the heights on the note elements precisely,
    // which we can only do when a note element is onscreen. Otherwise it's approximate.
    StretchyGrid.setNoteSize(StretchyGrid.noteSize);

    this.attachListeners();

    if (!Page.shared)
       DD.init();

    Page.Hotkeys.init();

    this.showSaveStatus(this.saveStatus.saved);

    window.onbeforeunload = function(){
      if (Messages.syncTimer != null) {
        return "Some notes have not been saved; do you still want to exit?";
      }
    };

    // If we need to be focusing a specific note upon load, do so when its editor is fully initialized
    // and able to be focused. Also scroll to that element
    if (this.focusWhenLoaded!=null){
      var focusId = 'cnote' + this.focusWhenLoaded;
      if ($(focusId)){
        var editor = $('note'+this.focusWhenLoaded).editor;
        var scrollTo = function(){$(focusId).note.scrollIntoView();};
        editor.executeWhenReady([scrollTo,editor.focus.bind(editor)]);
      }
    }
    log("page loading time minus images:",((new Date()).getTime()-beganLoading)/1000);

    // debug  helper
    if (!Page.production) { first = $$('.note')[0]; if (first) {first = first.note; ed=first.editor;}}
  },

  /*
   * A partial initialization for subpages of the site
   */
  partialInit:function(){
    // dynamically resize the note-area as we resize the browser
    Notes.overflowContainer = window.ie6 ? $('note-area') : $('note-scroll');
    // if (Notes.overflowContainer){
    //   $(window).addEvent('resize',Page.resizeNoteArea);
    //   this.resizeNoteArea();
    // }

    ModalDialog.init();

    Login.init();

    this.attachListeners();
  },
  /*
   * we must explicitly set the height of the note-area
  */
  resizeNoteArea:function(){
    Notes.overflowContainer.style.height = window.getHeight() - Notes.overflowContainer.getTop() + "px";
  },
  /*
   * Attach listeners to page level elements, like the header controls
   */
  attachListeners:function(){
    // Hook up the UI buttons, if we have UI controls. We don't have UI controls
    // on subpages of the site, like search
    if ($('new')){
      $('new').onclick=function(){Notes.newNote();return false;};

      $('notesize-bigger').onclick=function(){
        if (window.ie) this.blur();
        return ViewPreferences.biggerNotes();
      };
      $('notesize-smaller').onclick=function(){
        if (window.ie) this.blur();
        return ViewPreferences.smallerNotes();
      };

      // #search and #search-button have their listeners attached in the html
      $('search-clear').addEvent('click',function(){
        // Search.search("");
        Search.deactivate();
        $('search').value="";
        $('search').focus();
      });

      Search.attachListeners();

      $('print').onclick=function(ev){
        // open a new window each time print is clicked.
        window.open(ev.target.href); return false;
      }.bindWithEvent(this);

      // this could be refactored into controls.filemenu
      this.noteboardOptionsMenu = new Controls.FileMenu(
        {toggleButton:$('noteboard-options')},
        {text:"Rename noteboard", handler:this.renameNoteboardClick.bind(this), disabled:Page.shared},
        {text:"Delete noteboard", handler:this.deleteNoteboardClick.bind(this), disabled:Page.shared }
      );
      this.noteboardOptionsMenu.addEvent("hide",function(){
        $('noteboard-options').removeClass("menu-active");
      });

      $("noteboard-options").onclick=function(){
        var n = $('noteboard-options');
        if (n.hasClass("menu-active"))
          Page.noteboardOptionsMenu.hide("menu-active");
        else{
          Page.noteboardOptionsMenu.display(n,{anchorRight:true});
          n.addClass("menu-active");
        }
        return false;
      };
    }
    if ($('create-noteboard')){
      // form for creating a noteboard
      this.createNoteboardForm = new Forms.EnhancedForm($('create-noteboard-ui'), {
        validateKeypress: Forms.Validation.noEmptyTextFields,

        validateSubmit: function() {
          $('search-message').innerHTML="<strong>Sign in to create new noteboards.</strong>";
        },

        submitOnSuccess:true,
        cancel:function(){Page.createNoteboardForm.toggle(); return false;},
        submit:function(){}
      });

      $E('a',$('create-noteboard')).onclick=function(){ Page.createNoteboardForm.toggle(); return false;};

    }
  },
  showKeyboardShortcuts:function(){
    var contents = div({id:"keyboard-shortcuts-dialog"},
      h4({style:"margin-top:0"},"Anywhere:"),
      p("New note: Shift+Ctrl+N"),
      p("Search: Shift+Ctrl+L"),
      h4("Inside of notes:"),
      p("Undo: Ctrl+Z"),
      p("Bullet points: Ctrl+U"),
      p("Create link: Ctrl+K"),
      p("Bold: Ctrl+B"),
      p("Next note: Tab")
    );
    var d = this.hotkeysDialog;
    if (!this.hotkeysDialog){
      d = this.hotkeysDialog = new ModalDialog({
        width:"170px",
        cancelButton:false,
        contents:contents,
        modal:false,
        showAnimation:function(el){
          el.setStyle("opacity",0);
          el.style.left="-6px";
          // show this right under the keyboard-shortcuts button
          el.style.top = $('keyboard-shortcuts').getPosition().y+14+"px";
          el.style.display="";
          el.effect('opacity',{duration:400}).start(0.0,1.0);//?.chain(whenDone);
        }
      });
    }
    if (d.wrapper.style.display=="none")
      d.show();
    else
      d.close();
  },
  renameNoteboardClick:function(){
    if (!this.renameDialog){
      var formHTML =
        form({action:Page.urlToBoard+"/rename", method:"post"},
        p("New name:") + input({type:"text", name:"name", style:"width:98%"})
      );
      this.renameDialog=new ModalDialog({
        title:"Rename this noteboard",
        submitButton:"Rename",
        width:"300px",
        contents: formHTML,
        onClose:function(ev){
          if (!ev.cancelled) {
            if (Page.demo)
              $('search-message').innerHTML="<strong>You must sign in to rename your noteboards.</strong>";
            else
              $E('form',ev.dialog).submit();
          }
          // don't hide this dialog upon submission
          ev.cancelClose = !ev.cancelled && !Page.demo;
        }
      });
    }

    this.renameDialog.show();
  },
  deleteNoteboardClick:function(){
    if (!this.deleteDialog){
      var formHTML =
        form({action:Page.urlToBoard +"/delete", method:"post"},
        p("Are you sure you want to delete this noteboard?"),
        input({type:"hidden", name:"confirm", value:"yes"})
      );

      var singleNoteboard = Page.boards.length<=1;

      if (singleNoteboard) formHTML = p("You cannot delete your only noteboard.");

      this.deleteDialog=new ModalDialog({
        title:"Delete this noteboard",
        submitButton: singleNoteboard ? "Ok" : "Delete noteboard",
        cancelButton: !singleNoteboard,
        width:"300px",
        contents: formHTML,
        onClose:function(ev){
          if (!ev.cancelled && !singleNoteboard) {
            if (Page.demo)
              $('search-message').innerHTML="<strong>You must sign in to delete noteboards.</strong";
            else
              $E('form',ev.dialog).submit();
          }
          // don't hide this dialog upon submission
          ev.cancelClose = !ev.cancelled && !Page.demo;
        }
      });
    }

    this.deleteDialog.show();
    return false;
  },
  /*
   * Shows a status message. If you pass an undoFunction, an undo button will be added
   */
  showStatus:function(message,undoFunction){
    // I wanted to use an opacity effect here, but opacity doesn't work when it's inside the header.
    // could fade the message in using a background blur. For now, just show it I guess.
    // msg.effect('background-color',{duration:1500}).start('#ffffff','#e4eaee');
    $('status-message').innerHTML=message+" ";
    if (undoFunction){
      var a = document.createElement("a");
      a.innerHTML="Undo";
      a.onclick = this.createUndoFunction(undoFunction);
      a.href="#";
      $('status-message').appendChild(a);
    }
  },
  createUndoFunction:function(undoFunction){
    return function(){undoFunction(); return false;};
  },
  /*
   * Shows a UI message telling us the save status of our noteboard
   */
  saveStatus:{unsaved:1,saving:2,saved:3},
  showSaveStatus:function(status){
    var el = $('save-status');
    var useButton=false;

    var messages = {};
    messages[this.saveStatus.unsaved] = "Not saved";
    messages[this.saveStatus.saving] = "Saving...";
    messages[this.saveStatus.saved] = "Saved";

    // Part of an ugly hack to include last save time
    var lastSaveText = 'Unknown';
    var lastSave = $('last-save');
    if (lastSave) {
      var d = new Date();
      var n = parseInt(lastSave.innerHTML, 10);
      if (!isNaN(n)) {
          d.setTime(n);
          lastSaveText = d.toString();
                        }
                }

    el.innerHTML = '<span title="Last Save: ' + lastSaveText +'">' + messages[status] + '</span>';

  },
  /*
   * Pulsate an element's property from light to dark orange, and then to some end color
   */
  flashEffect:function(element,cssProperty,endColor){
    cssProperty = cssProperty || "background-color";
    // If they didn't provide an end color, then end up on whatever the color is currently set to
    endColor = endColor || element.getStyle(cssProperty);
    var middleColor = "#ffc391";
    var animate = new Fx.Style(element,cssProperty,{duration:500});

    animate.start("#ffe6c3",middleColor).chain(animate.start.pass([middleColor,endColor],animate)).chain(function(){
      // set the property back to its default
      element.setStyle(cssProperty,"");
    });
  },
  /*
   * Checks to see if the window is ours, and that it's not closed
   *
   * Useful for popup management.
   */
  isJjotWindow:function(window){
    try{
      return window && !window.closed && window.Notes;
    }catch(e){

    }
    return false;
  }
};

/*
 * Page level hotkeys, like adding new notes.
 * The iframe rich text editors propagate their key events to this function as well,
 * so hotkeys will work while a rte is focused.
 */
Page.Hotkeys={
  init:function(){
    this.keydown={};
    this.keypress={};

    if (!Page.production){
      this.add("keydown",'ctrl_1',function(){
          log("crl 1 handler");
          $$('.note')[0].note.focus(true);
        });
    }
    this.add("keydown",["ctrl_shift_n", "ctrl_shift_1"],  function(){ Notes.newNote();});
    this.add("keydown",["ctrl_shift_2", "ctrl_shift_l"], function(){ $('search').focus(); });

    // using a wrapper function to prevent IE from cancelling key events. See HotKeyManager
    document.addEvent('keydown',function(ev){this.runHandlerForKey(ev);}.bindWithEvent(this));
    // document.addEvent('keypress',this.runHandlerForKey.bindWithEvent(this));

  }
};
Page.Hotkeys = $extend(Page.Hotkeys,HotkeyManager);


/*
 * The login panels are a bit tricky. We have two ways of animating the slide-in:
 *  1) position the dialog off the side of the page, and slide it in
 *  2) position the dialog on the right side of the page with zero width, and grow the width
 *     to simulate sliding it in
 *
 * IE6 needs the second version because it does not support position:fixed. Position:fixed allows the first
 *  version to reside off the side of the page without triggering horizontal scrollbars.
 *
 * Why not have everyone use method 2 then? 1 is probably more fluid, and 2 doesn't allow you to focus the
 *  field until the dialog is done animating.
 */
Login={
  /* the method we should use to animate the dialog (corresponds to (2) above) */
  useWidth:window.ie6 || window.opera,

  /* the width of the extra padding on the dialog; it needs to be extra wide, because it overextends itself
    while sliding in*/
  rightOffset:20,

  slideInDuration:600,

  init:function(){
    this.signupPanel=$('signup-panel');

    // some pages don't have the slide-in login forms
    if (!this.signupPanel) return;

    this.signupPanel.form = new Forms.EnhancedForm(this.signupPanel,{
      submit: jjotutil.alterSubmitUrl.pass(["/signup/","new-username"]),
      validateSubmit: function() {
        $('search-message').innerHTML="<strong>Sign up is currently disabled.</strong>";
      },
      cancel:this.toggleSignup
    });

    this.signinPanel=$('signin-panel');

    this.signinPanel.form = new Forms.EnhancedForm(this.signinPanel,{
      submit:jjotutil.alterSubmitUrl.pass(["/signin/","existing-username"]),
      validateSubmit: function() {
        $('search-message').innerHTML="<strong>Sign in is currently disabled.</strong>";
      },
      cancel:this.toggleSignin
    });

    // set up animations, store them by ID
    this.anims=[];
    [this.signinPanel,this.signupPanel].each(function(e){
      this.anims[e.id]={ slideIn:this.slideInAnimation(e), slideOut:this.slideOutAnimation(e) };
    }.bind(this));

    $E('.x',this.signupPanel).onclick = this.toggleSignup;
    $E('.x',this.signinPanel).onclick = this.toggleSignin;

    // Links at the top of header
    var su = $('sign-up'); if (su) su.onclick = this.toggleSignup;
    var si = $('sign-in'); if (si) si.onclick = this.toggleSignin;
  },
  toggleSignup:function(){
    return Login.togglePanel(Login.signupPanel);
  },
  toggleSignin:function(){
    return Login.togglePanel(Login.signinPanel);
  },
  slideInAnimation:function(e){
    return new Fx.Style(e, this.useWidth ? 'width' : 'right', {
        duration: this.slideInDuration,
        transition: Login.backOut,
        onComplete:this.slideInComplete.bind(this)
      });
  },
  slideOutAnimation:function(e){
    return new Fx.Style(e, this.useWidth ? 'width' : 'right', {
      duration: 250,
      transition: Login.quadIn,
      onComplete:this.slideOutComplete.bind(this)
    });
  },
  slideInComplete:function(e){
    if (window.geckp)
      e.style.overflow = "auto";

    e.animating=false;

    // useWidth dialog waits until now to focus its first input. Also,
    // need to refocus the input a second time for mozilla, or the textbox's text caret will
    // be invisible because we've just changed the dialog's overflow: property.
    e.focusFirstInput();

  },
  slideOutComplete:function(e){
    // Reset the width to be automatic once we're done.
    e.style.display="none";
    e.style.overflow="";

    if (this.useWidth){
      e.style.width = "0";
      e.style.right = "0";
    }else
      e.style.right = -e.cachedWidth;

    e.animating = false;
  },
  slideIn:function(e){

    /* if it's our first time sliding in the dialog, figure out how wide it is
     * so we know how far to slide it in */
    if (!e.cachedWidth){
      // show the dialog invisibily before calculating its width;
      // safari can't calculate widths of hidden objects
      e.style.right = 0;
      e.setStyle("visibility","hidden");

      if (window.gecko) e.style.overflow = "";

      e.style.display="";

      e.style.width="";

      e.cachedWidth=e.getStyle('width').toInt();

      // set the X button to be relative to the left side of the dialog, not the right, so that
      // it doesn't sit in the upper right corner as we slide it in (a concern with useWidth only)
      var xButton = $E('.x',e);
      xButton.style.left =
        e.cachedWidth - xButton.offsetWidth - (this.useWidth ? 4 : this.rightOffset) -15 + "px";
    }
    if (this.useWidth)
      e.style.width=0;
    else
      e.style.right =- e.cachedWidth+"px";


    e.style.visibility="";
    e.style.display="";
    e.style.overflow="";
    e.animating=true;

    if (this.useWidth)
      this.slideInAnimation(e).start(e.cachedWidth);
    else
      this.slideInAnimation(e).start(-e.cachedWidth,-this.rightOffset);

    // for the width-based dialog, wait until it's shown before you focus the input
    if (!this.useWidth)
      e.focusFirstInput();

  },
  slideOut:function(e){
    Login.anims[e.id].slideIn.stop();

    if (window.gecko) e.style.overflow = "";

    Login.anims[e.id].slideOut.start(this.useWidth ? 0 : -e.cachedWidth);

    e.animating=true;
  },

  togglePanel:function(e){
    if (this.signinPanel.animating || this.signupPanel.animating)
      return false;

    if (e==this.signupPanel && this.signinPanel.style.display!="none")
      this.slideOut(this.signinPanel);
    else if (e==this.signinPanel && this.signupPanel.style.display!="none")
      this.slideOut(this.signupPanel);


    this.animating=true;

    if (e.style.display=="none")
      this.slideIn(e);
    else
      this.slideOut(e);

    return false;
  },
  /*
  * Modified version of Mootools's backOut function, so that the signup panel's
  * bounce" animation is more subtle
  */
  backOut: function(p, x){
    // x = x[0] || 1.618;
    x =  .7;  // original was 1.618, then  1.00158 by me
    p=1-p;
    var a= Math.pow(p, 2) * ((x + 1) * p - x);
     return 1-a;
  },
  /* From MooTool's transitions.fx.js */
  quadIn:function(p){
    return Math.pow(p, 2 || 6);
  }
};

var ViewPreferences={
  // Default noteboard size
  noteboardSize:4,
  biggerNotes:function(){
    StretchyGrid.bigger();
    return false;
  },
  smallerNotes:function(){
    StretchyGrid.smaller();
    return false;
  },

  parseCookie:function(){
    var cookie = Cookie.get("jjot-nb");
    if (!cookie)
      return {};

    var res={};
    // If we somehow got a cookie that wasn't valid Json, reset the prefs to empty
    try{
      res=Json.evaluate(cookie);
    }catch(e){}

    return res;
  },
  /*
  * Gets a preference for the current noteboard. Null if we don't
  * have that preference recorded.
  */
  getPreference:function(name){
    var noteboards = this.parseCookie();
    // if (noteboards[Page.boardId])
    if (noteboards[Page.boardIdentifier])
      return noteboards[Page.boardIdentifier][name];
    return null;
  },
  /*
  * Sets the maximizd state of a note
  */
  setMaximized:function(noteId,maximized){
    var maxed = this.getPreference("max");

    var maxedNotes = maxed || [];
    if (maximized && maxedNotes.indexOf(noteId)<0)
      maxedNotes.push(noteId);
    else if (!maximized && maxedNotes.indexOf(noteId)>=0)
      maxedNotes.splice(maxedNotes.indexOf(noteId),1);

    this.setPreference('max',maxedNotes);
  },
  /*
  * Returns a map of ids for maximized notes
  */
  maximizedNoteIds:function(){
    var map={};
    var ids = this.getPreference('max');
    ids = ids || [];
    ids.each(function(e){
      map[e]=true;
    });
    return map;
  },
  /*
  * Sets a note preference for this noteboard
  */
  setPreference:function(name,value){
    var noteboards = this.parseCookie();
    // Find/create the prefs object for this noteoard
    var prefs= noteboards[Page.boardIdentifier] || {};
    prefs[name]=value;
    noteboards[Page.boardIdentifier]=prefs;
    Cookie.set('jjot-nb', Json.toString(noteboards), {duration:90,path:"/"});
  }
};
