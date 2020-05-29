/*
 * note.js
 * Creation and saving of note DOM elements
 *
 */

/*
 * Functions for the global collection of notes
 */
Notes = {
  board:"",

  /*
   * Build some master dialogs that each note can clone
   */
  init:function(){
    Messages.addEvent("untrash",this.untrash.bind(this));
  },

  /*
   * ID and contents are optional. If they're not provided, a new ID will be generated
   *
   * options:
   *   flashEffect - [false] highlights the note with a flashing animation
   *  saveContents - [true] saves the contents of the note. Unnecessary for unarchive and undelte operations.
   */
  newNote:function(id, contents, options){
    options = options || {};
    newNoteTimer = (new Date()).getTime();
    var id = id || this.newID();
    var node = $(this.newHtmlNode(id,contents));

    if ($('note-area').getFirst() == false)
      $('note-area').appendChild(node);
    else
      $('note-area').insertBefore(node, $('note-area').getFirst());

    // Do not fade in new notes. It screws up the title selection we have, and if you type
    // while a new rte is being created, Mozilla midas can get really screwed up. Maybe fade it in,
    // then initialize the editor?
    // node.effect('opacity',{duration:500}).start(0,1.0);

    var n = new Note(node);
    DD.setupDragDrop();

    // When the editor is ready, save it.
    // If it's a new note, select the title node and focus, so the user
    // can type over the generated title if they like.
    var saveFunction = function(){
      if (options.saveContents!=false)
        Messages.doSync("save", n.getNoteData());
      Messages.saveOrder();
    }.bind(this);

    var toExecute=[n.editor.focus.bind(n.editor), saveFunction];

    if (!contents)
      toExecute.unshift(n.editor.selectTitleNode.bind(n.editor));

    n.editor.executeWhenReady(toExecute);

    console.log('creating new note ' + id);

    // scroll to the note, in case we're scrolled down the page some
    n.scrollIntoView();

    if (options.flashEffect){
      var titleBar= $E('.titlebar',n.element);
      Page.flashEffect(titleBar);
    }

    return false;
  },
  /*
   * For display in the UI
   */
  formatTitleForDisplay:function(title){
    return title.truncate(18) || "untitled";
  },
  /*
   * Returns all the notes on the current board, in order
   */
  getAll:function(){
    return $ES('.note','note-area').map(function(e){return e.note;});
  },
  /*
   * Delete a note - do not send it to the archive, do not pass go; collect no money!
   */
  // deleteNote:function(id,title){
  deleteNote:function(noteData){
    var noteid='cnote'+noteData.id;
    log("Deleting note with id",noteData.id);

    // remove the note if it's still ont he page
    if ($(noteid))
       $(noteid).remove();

    Archived.removeFromArchive(noteData.id,true);

    Page.showStatus(
      "\"" + Notes.formatTitleForDisplay(noteData.title) + "\" was deleted.",
      function(){ Messages.doSync("untrash",{id:noteData.id}); }
    );

    Messages.doSync("trash", noteData);
  },
  untrash:function(note){
    Notes.newNote(note.id,note.text, {flashEffect:true, saveContents:false});
    Page.showStatus("");
  },

  newHtmlNode:function(id,content){
    var noteIdString = 'note'+id;

    var note = document.createElement("div");
    note.id="c"+noteIdString;
    note.className="note notebox";

    // Big html block that gets generated. Copy and paste this from what's used in _note.rhtml
    // if _note.rhtml ever changes.
    var html = '<div class="note_padding">'+
        '<div class="b1"><div class="b2"><div class="b3">'+
          '<div class="titlebar" id="c<%=id%>_tb">'+
            '<div id="c<%=id%>_buttons" class="buttons">'+
              '<a href="#" class="bold button"></a><a href="#" class="link button"></a>'+
              '<a href="#" class="bullets button"></a><a href="#" class="more button"></a>'+
            '</div>'+
            '<div class="metabuttons">'+
              '<a href="#" class="maximize button"></a><a href="#" class="delete button"></a>'+
            '</div>'+
            '<div id="c<%=id%>_drag" class="drag"></div>'+
          '</div>'+
           '<div class="titlebar-divider"></div>'+
            '<div class="editor-parent">'+
              '<textarea id="<%=id%>" name="elm<%=id%>" rows="10" cols="40"><%=note.text%></textarea>'+
            '</div>'+
        '</div></div></div>'+
      '</div>';

    html=html.replace(/<%=id%>/g,noteIdString);

    // Adding two breaks after the title, so you can click below the title on a new line
    // and be able to start typing
    content = content || "<p class='title'>"+this.dateString()+"</p>";
    // content = content || "<div class='title'>"+this.dateString()+"</div>hey "+
    // "<a href='/123'><span>this is a span link boss</span></a> do <a href='456'>reg link</a><br/>";
    html=html.replace(/<%=note.text%>/,content);
    note.innerHTML=html;

    return note;
  },

  dateString:function(){
    var months = new Array("Jan", "Feb", "March",
    "April", "May", "June", "July", "Aug", "Sept",
    "Oct", "Nov", "Dec");
    var d = new Date();
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  },

  noteIds:function(){
    // Cut out "cnote" from the id string; it's not part of the ID
    return $$('.note').map(function(e){return e.id.substring(5);});
  },
  /*
   * Generates a new ID for a note. Should be long enough to make collisions improbable.
   * This should match new_uniqid in note.rb
   */
  newID:function(){
    // 9 digits
    return $random(0,1000000000);
  }
};


/*
 * Note object, including the DOM element, textarea, and rich text editor
 *
 *  element: parent DOM element, containing the toolbars, textarea, all that mess. Has class .note
 *  editor: the rich text editor
 */
var Note = new Class({

  /*
   * element: an element with class "note"
   */
  initialize:function(element, maximized){
    this.element=$(element);
    this.textarea=element.getElementsByTagName("textarea")[0];

    this.textarea.note=this;
    this.element.note=this;
    this.editor = rte.attach(this.textarea);

    this.editor.addEvent('focus',this.onFocus.bind(this));
    this.editor.addEvent('blur',this.onBlur.bind(this));

    // $E('.editor-parent',this.element).addEvent('blur',function(){log("editor parent blurred");});
    // $E('.editor-parent',this.element).addEvent('mousedown',function(){log("editor-parent mousedown");});
    // this.element.addEvent('blur',function(){log("note parent blurred");});
    this.editor.addEvent('dialogShow',this.onDialogShow.bind(this));
    this.editor.addEvent('dialogHide',this.onDialogHide.bind(this));

    // textarea's ID might be 'note_1234' - strip out the "note_" part
    this.noteId=this.textarea.id.substring(4);

    this.editor.addEvent('changed',this.onChanged.bindAsEventListener(this));

    this.maximizeButton=this.element.getElementsBySelector('.maximize')[0];
    this.maximizeButton.onclick=this.toggleMaximize.bind(this);

    if (!Page.popout)
      this.element.getElementsBySelector('.delete')[0].onclick = this.archive.bind(this);


    this.moreButton=this.element.getElementsBySelector('.more')[0];
    this.moreButton.onclick=this.showMoreMenuClick.bind(this);

    if (maximized)
      this.setMaximizedState(true, true);

    GC.run(this.gc.bind(this));
  },
  getNoteData:function(){
    return {
      id:this.noteId,
      text:this.getText(),
      title:this.getTitle()
    };
  },
  /* you can visually focus a note without puttin the text caret inside the note; used by search */
  focus:function(focusCursor){
    if (focusCursor)
      // this.editor.executeWhenReady([this.editor.focus.bind(this.editor)]);
      this.editor.focus();
    else
      this.onFocus();
  },
  onFocus:function(){
    if (Notes.lastFocused)
      Notes.lastFocused.element.removeClass("focused");
    //   Notes.lastFocused.removeFocus();

    // if (window.ie){
    //   $E('div.note_padding',this.element).applyClass(Stylesheets.rules.note_paddingFocused);
    //   $E('.b2',this.element).applyClass(Stylesheets.rules.b2Focused);
    //   $E('.b3',this.element).applyClass(Stylesheets.rules.b3Focused);
    // }else
      this.element.addClass("focused");
    Notes.lastFocused=this;

    if (this.element.hasClass("search-miss"))
      Search.deactivate();
  },
  onBlur:function(){
    // if (window.ie){
    //   $E('div.note_padding',this.element).unapplyClass(Stylesheets.rules.note_paddingFocused);
    //   $E('.b2',this.element).unapplyClass(Stylesheets.rules.b2Focused);
    //   $E('.b3',this.element).unapplyClass(Stylesheets.rules.b3Focused);
    // }else

    this.element.removeClass("focused");
  },
  onDialogShow:function(){ this.element.addClass("dialog-showing");},
  onDialogHide:function(){ this.element.removeClass("dialog-showing");},

  onChanged:function(editor){
    // Registers this note to be saved
    // Seems like there's a bug in firefox which throws an exception (0x80004005) if an xhr is
    // opened from a response to an iframe event. So.. change execution context to current page using a delay call.
    var f = function() {Messages.doSync("save", this.getNoteData());};
    f.delay(10,this);
  },


  archive:function(){
    // If they double click on the "x" really quick, don't register the second click
    // after we've already started the archive animation.
    if (this.archiving || Page.shared)
      return false;

    console.log('archiving note ' + this.noteId);

    this.archiving=true;

    var whenDone = function(){
      Archived.add(this.getNoteData());
      this.element.remove();
    }.bind(this);

    // For now, don't animate this. Takes too long. Just delete immediately.
    // this.element.effect('opacity',{duration:650}).start(0.0).chain(whenDone);
    whenDone();


    // Remove maximization from the cookie, so this note doesn't get maximized again when it's unarchived
    ViewPreferences.setMaximized(this.noteId,false);

    return false;
  },

  /*
   * Move this note to another noteboard.
   * This can never get called with a demo account. No need to check.
   */
  moveTo:function(boardNumber, boardName){
    var noteData = this.getNoteData();
    this.element.remove();
    Page.showStatus("Moved \"" +
      Notes.formatTitleForDisplay(noteData.title) +"\" to <strong>" + boardName +"</strong>.");  //no undo atm
    var nb = $('nb-'+boardNumber);
    Page.flashEffect(nb,"background-color","#FFFFFF");

    noteData.board = boardNumber;
    Messages.doSync("move",noteData);
  },
  /*
   * Sets the maximized state of a note.
   * If the note becomes offscreen when we maximize it, because it drops to the next line,
   * then we scroll it into view.
   * pageLoading: true if we're maximizing on the initial page load. In that case, don't do any scrolling.
   */
  setMaximizedState:function(state, pageLoading){
    if (state){
      this.element.addClass('maximized');
      // Set the toolbar button to 'on'
      this.maximizeButton.addClass("on");
      this.maximized=true;
    }else{
      this.element.removeClass('maximized');
      // Set the toolbar button to 'off'
      this.maximizeButton.removeClass("on");
      this.maximized=false;
    }
    if (!pageLoading){
      if (!Page.popout) this.scrollIntoView();
      this.editor.focus();
    }
    this.fireEvent("maximize");
  },
  /*
   * Scrolls the given element into view. This is pretty generic, could be put elsewhere.
   */
  scrollIntoView:function(duration){
    Notes.overflowContainer.scrollUntilVisible(this.element,duration);
  },
  toggleMaximize:function(){
      this.setMaximizedState(!this.maximized);
    // we don't save changes to maximization states made in popouts. It's a little funny.
    if (!Page.popout)
      ViewPreferences.setMaximized(this.noteId,this.maximized);
    return false;
  },
  /*
   * Every note has a "more menu" that drops down; they're lazily initialized.
   */
  showMoreMenuClick:function(){
    if (!this.moreMenu){
      this.moreMenu = new Controls.FileMenu(
        {toggleButton:this.moreButton},
        {text:"Pop-out", handler:Notes.popout.pass([this.noteId],Notes), disabled:Page.popout},
        {text:"Email to...", handler:this.menuEmailClick.bind(this), disabled:Page.popout},
        {text:"Print", handler:this.menuPrintClick.bind(this)},
        {text:"Move", handler:this.menuMoveClick.bind(this), disabled:(Page.popout || Page.shared || Page.boards.length<=1)},
        {text:"Delete", handler:this.menuDeleteClick.bind(this), disabled:(Page.popout ||Page.shared)}
      );
      this.moreMenu.addEvent('hide',function(){
        this.moreButton.removeClass("menu-active");
      }.bind(this));
    }

    // If they're clicking on a button that's already active, they want to hide the menu
    if (this.moreButton.hasClass("menu-active"))
      Controls.FileMenu.hideActive();
    else
      this.showMoreMenu();

    return false;
  },
  showMoreMenu:function(){
    /* I'm using manual coordinates here because using position:relative on .b3 seems to mess them up by a few pixels */
    var adjust = window.ie6 ? 8 : 6;
    this.moreMenu.display(this.moreButton, {
      left:this.moreButton.getLeft() - this.moreButton.getParent().getLeft() - adjust,
       top:this.moreButton.getSize().size.y - adjust+1
    });
    this.moreButton.addClass("menu-active");
  },
  moveDialogResult:function(ev){
    if (ev.cancelled) return;
    this.onDialogHide();
    var selected = Forms.util.selectedRadio($E('input[type=radio]',this.moveDialog));
    this.moveTo(selected.getAttribute("number"), selected.value);
  },
  emailDialogResult:function(ev){
    if (ev.cancelled) return;
    this.onDialogHide();

    var text = $E('.emails',ev.dialog).value.split(/[\s\n,]/);
    var emails =[];
    text.each(function(e){
      e=e.trim();
      if (e.contains("@"))
        emails.push(e);
    });

    var data = this.getNoteData();
    var postData = {
      emails:emails,
      metoo:false,
      noteText:data.text,
      noteTitle:data.title
    };

    Page.showStatus("Emailing your note...");
    var a = new Ajax(Page.urlToBoard + "/email", {
      postBody:Json.toString(postData),
      method:"post",
      onSuccess:function(){
        Page.showStatus("Your note has been emailed to " + emails.length + (emails.length==1 ? " person" : " people") + ".");
      }
    });
    a.request();

  },
  emailPreview:function(){
    var html =
      p("This is what the email will look like:")+
      hr();
  },
  menuEmailClick:function(ev){
    if (!this.emailDialog){
      var formHTML =
        form({action:"#", cls:"email-form"},
        p({cls:"comment"},"Type in some email addresses separated by commas or spaces"),
        textarea({cls:"emails"})
        // p(a({href:"#", cls:"preview-email"}, "Preview and customize the email"))
      );

      if (Page.demo) formHTML = p("You must sign in before you can email notes to people.");

      this.emailDialog = new ModalDialog({
        title:"Email this note to...",
        submitButton: Page.demo ? "Ok" : "Email note",
        cancelButton: !Page.demo,
        contents: formHTML,
        width:"340px",
        container:Notes.overflowContainer,
        parent:this.element,
        onClose:Page.demo ? null : this.emailDialogResult.bind(this)
      });
    }
    this.onDialogShow();
    this.emailDialog.show();
    return false;
  },
  menuMoveClick:function(ev){
    if (!this.moveDialog){
        var listItems = "";
        Page.boards.each(function(e){
          var disabled = (e.number==Page.boardNumber) ? "disabled" : "";
          listItems+="<li class='"+disabled+"'><label>"+
            "<input type='radio' name='board' value='"+e.name+"' number='"+e.number+"' " + disabled +">"+e.name+"</label></li>";
          });
        var formHTML =
          form({action:"#"},
          ul({cls:"options radio-group"},listItems)
        );

      this.moveDialog = new ModalDialog({
        title:"Move this note to...",
        submitButton:"Ok",
        contents: formHTML,
        container:Notes.overflowContainer,
        parent:this.element,
        onClose:this.moveDialogResult.bind(this)
      });

    }
    this.onDialogShow();
    this.moveDialog.show();
    // Check off the first radio button
    // IE needs to have the radios visible before making them checked, I believe.
    Forms.util.selectFirstActiveRadio($E('input[type=radio]',this.moveDialog.dialogBody));

    return false;
  },
  menuPrintClick:function(){
    var w = window.open(Page.urlToBoard + "/print/" + this.noteId);

    // The server doesn't have any of demo's data, so put it in the window directly
    // Disabling for now, because print needs some extra server-side processing.
    if (Page.boardOwner=="demo") w.demoNoteData = this.getNoteData();

    return false;
  },
  menuDeleteClick:function(ev){
    Notes.deleteNote(this.getNoteData());
    return false;
  },
  gc:function(){
    this.editor.gc();
    this.moreButton=this.maximizeButton=null;
    this.moveDialog=null;
    this.textarea.note=null;
    this.textarea=null;

    this.element.note=null;

    // any DD stuff. This should be handled by mootools; not sure why I'm doing it myself.
    if (this.element.dragObject)
    this.element.dragObject=this.element.dragObject.handle=null;

    this.element=null;
  },
  /* might deprecate these in favor of getNoteData() */
  getText:function(){
    return this.textarea.value.trim();
  },
  getTitle:function(){
    return this.editor.getTitle();
  }
});
Note.implement(new Events());
/*
 * Returns the associated Note object if you pass in a parent DOM node like 'cnotex'
 */
Note.forElement=function(elem){
  if (elem.tagName.toLowerCase()=="textarea")
    return elem.note;
  return elem.getElementsByTagName("textarea")[0].note;
};
