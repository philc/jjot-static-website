var Search = {
  // all the matching notes
  matches:[],
  currentQuery:"",
  // true when a search is active, meaning we've got notes darkened on the noteboard, etc.
  active:false,
  // index of the currently highlighted note
  ni:0,
  menu:null,
  // index into the drop-down menu. This is unfortunately slightly different than ni, because
  // we can be highlighting a note on the noteboard, but not have any entry selected in the drop
  // down menu (menuindex==null). In contrast, ni can never be null.
  menuIndex:null,
  // true if they've hit esc (to hide the menu), and so we shouldn't show it again
  // until they leave the search field and come back (or they hit esc again).
  hidingMenu:false,
  attachListeners:function(){
    var s = $('search');
    s.addEvent('keypress',this.onkeypress.bindWithEvent(this));
    // trigger our search onkeyup
    s.addEvent('keyup',this.onkeyup.bindWithEvent(this));
    s.addEvent('keydown',this.onkeydown.bindWithEvent(this));

    // remove the old listener. Adding more than one listener causes leaks in IE6
    s.removeEvent('focus',searchFocusCheck);
    s.addEvent('focus',function(){
        searchFocusCheck.bind(this)();
        Search.hidingMenu=false;
        if (this.value!="" && !$(this).hasClass("blank"))
          Search.search(this.value,true);
    });
    s.addEvent('onblur',function(){
      Search.menu.destroy();
    });
    s.addEvent('click',function(e){
      if (this.value!="")
        Search.search(this.value);
    });

  },

  /* We have to handle (and cancel) the esc key in the keydown event, not keypress,
     or IE will handle it by clearing the search field for us.
  */
  onkeydown:function(ev){
    if (ev.key=="esc"){
      // esc key toggles the note menu
      this.hidingMenu=!this.hidingMenu;
      if (this.hidingMenu)
        this.menu.hide();
      else
        this.showMenu();
      ev.stop();
    }
    // listen for "up" and "down" here, because IE won't fire a keypress event for those keys. Moz will.
    // Don't propogate the up and down keys, or they will move the caret to the beginning/end of the text field
    else if (ev.key=="down" || ev.key=="up"){
      ev.stop();

      // if there's no query, or no results, don't interpret these keys
      if ($('search').value.length==0 || this.matches.length==0) return;

      if (this.menuIndex==null)
        this.menuIndex= ev.key=="down" ? 0 : this.matches.length-1;
      else if (!this.hidingMenu){
        // increment or decrement the menu's index, but only if the menu isn't hidden.
        // if it is hidden, then pop it back up without changing the choice
        this.menuIndex=util.mod(this.menuIndex,this.matches.length, ev.key=="down" ? 1 : -1);
      }
      // if they hit up, they no longer want the menu hidden, if it was hidden previously
      this.hidingMenu=false;
      this.highlightNote(this.matches[this.menuIndex]);
      this.showMenu();
    }
  },
  onkeyup:function(ev){
    this.search($('search').value);
  },
  onkeypress:function(ev){
    if (ev.key=="enter"){
      if (this.menuIndex!=null && !this.hidingMenu){
        this.highlightNote(this.matches[this.menuIndex],true);
        ev.stop();
      }
      this.menu.hide();
    }
  },
  search:function(query, force){
    // if (Page.demo) {
    //   $('search-message').innerHTML =
    //     "<strong>You must sign in to search across your noteboards.</strong>";
    //   return;
    // }

    if (query==this.currentQuery && this.active && !force){
      if (!this.hidingMenu && (this.menu && !this.menu.visible())) this.showMenu();
      return;
    }

    this.currentQuery=query;
    this.active=true;
    this.menuIndex=null;

    if (query.length==0){
      this.matches=[];
      // ensure that no notes have a search-hit
      Notes.getAll().each(function(n){
        n.element.removeClass("search-miss");
        n.element.removeClass("search-hit");
        $(n.editor.bodyNode()).removeClass("ed-search-miss");
      });
    }else
      this.highlightResults(query, force);

    this.showMenu(force);
    this.updateSearchMessage(query);
  },
  /*
   * Runs through each note we have, and highlights it if it matches
   * the query
   */
  highlightResults:function(query, preventFocus){
    this.matches=[];
    // this.menuIndex=null;

    var regex = new RegExp(RegExp.escape(query),"i");
    var notes = Notes.getAll();

    for (var i=0;i<notes.length;i++){
      var n = notes[i];
      var el = n.element;

      // strip the HTML tags
      var strippedHTML = n.editor.bodyNode().innerHTML.replace(/<.*?>/g,"");

      if (strippedHTML.test(regex))
      {
        this.matches.push(n);
        el.removeClass('search-miss');
        el.addClass('search-hit');
        $(n.editor.bodyNode()).removeClass("ed-search-miss");

        // focus the first note we find
        if (this.matches.length==1 && !preventFocus) this.highlightNote(n);
      }else{
        el.removeClass('search-hit');
        el.addClass('search-miss');
        $(n.editor.bodyNode()).addClass("ed-search-miss");
      }
    }
  },

  buildMenu:function(){
    var entries=[];
    for (var i = 0; i < this.matches.length; i++)
      entries.push({
          text:this.matches[i].editor.getTitle(),
          handler:this.menuClick
      });

    // set menu options
    entries.push({
      limit:4,
      outsideClick: this.outsideMenuClick
    });
    return entries;
  },

  menuClick:function(e){
    // find out what index this <a> link is; index into Search.matches with that index
    Search.ni = util.dom.indexOfChild(e.target);
    Search.highlightNote(Search.matches[Search.ni],true);
  },
  /*
   * highlightMenuIndex: true to highlight an entry on the menu, false otherwise
   */
  showMenu:function(force){
    // don't build a menu if we've got no matches. Also don't show a huge giant menu
    // when the search box is blank
    if (this.matches.length == 0 || this.currentQuery == ""){
      if (this.menu) this.menu.destroy();
      return;
    }

    // don't create a new menu unless we need to
    var oldMenu;
    log("menu", this.menu);
    if (!this.menu || this.menu.query!=this.currentQuery || force){
      oldMenu = this.menu;
      this.menu = new Controls.FileMenu(this.buildMenu());
      this.menu.query=this.currentQuery;
    }

    if (!this.hidingMenu && !this.menu.visible()){
      this.menu.display($('search-box-wrapper'), {
        width: window.ie6 ? $('search').getStyle('width').toInt() + 5 : null
      });
    }

    if (this.menuIndex!=null)
      this.menu.highlight(this.menuIndex);

    // keep the old menu around for 30ms, to avoid visual flicker
    if (oldMenu) oldMenu.destroy.delay(30,oldMenu);
  },
  outsideMenuClick:function(ev){
    return ev.target!=$('search');
  },
  deactivate:function(){
    if (!this.active) return;
    var m = $$('.search-miss');
    for (var i=0;i<m.length;i++){
      var n = $(m[i]).note;
      n.element.removeClass("search-miss");
      $(n.editor.bodyNode()).removeClass("ed-search-miss");
    }
    this.active=false;
    $('search-message').innerHTML="";
  },
  updateSearchMessage:function(query){
    var msg="";
    if (query.length>0){
      var c = this.matches.length;
      msg="<div id='search-caption'>Notes containing the word"  +
      (query.test(" ") ? "s" : "") + " <strong>" + " " + query + "</strong></div>" +
      "<div id='search-count'>"+ c + (c==1 ? " match " : " matches ");

      // only show nav links if we have more than one match
      if (c>1)
        msg+= "&nbsp;<a href='#' onclick='return Search.next(-1);'>prev</a> &nbsp;<a href='#' onclick='return Search.next(1);'>next</a></div>";
    }
    $('search-message').innerHTML=msg;
  },
  /*
   * highlights a note by drawing a blue border around it (.focus style) and
   * scrolling to it. Can optionally transfer keyboard focus into the note
   */
  highlightNote:function(note,focusKeyboard){
    note.focus(focusKeyboard);
    note.scrollIntoView();
  },
  indexOfFocused:function(){
    // We can't find the currently focused node using $E('.focused'), because if you click off of it,
    // it instantly becomes unfocused. Instead, go from the last focused note, and ensure it's in the document
    var n = Notes.lastFocused;
    if (n && n.element.parentNode && !n.element.hasClass("search-miss"))
      return this.matches.indexOf(n);
    // if the last focused note isn't in the document, use the last note we focused through Search's "next" button
    return this.ni;
  },
  /*
   * Focuses the next next in our matches
   * direction: 1 for forward, -1 for backward
  */
  next:function(direction){
    this.ni = util.mod(Search.indexOfFocused(),this.matches.length,direction);
    this.highlightNote(this.matches[this.ni]);
    return false;
  }
};
