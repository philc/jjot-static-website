/*
* Code for the debugging panel
*/

Debug=new function(){
  this.useFirebug=true;

  this.init=function(){
    log("debgug init");
    this.debugPrefs={};
    $(document).addEvent('keydown',this.keydown.bindWithEvent(this));

    this.parseCookie();

    this.addButton('Clear cookies',this.clearCookies.bind(this));
    this.addButton('Print cookies',this.printCookies.bind(this));
    this.addBoolOption("debugOutput","Enable debug output");
    this.addBoolOption("instantSave","Instant save");

    var debugPanel = $('debug-panel');
    if (!debugPanel) return;

      Debug.Console.init();

    // If we don't have firebug, then use our special console, if it exists.
    if(debugPanel && (typeof console=="undefined" || !this.useFirebug))
      console={log: Debug.Console.log };


    var tabs = new Controls.TabPanel('debug-tabs');
    tabs.addTab('console',Debug.Console.element);

    // build output element
    var o = document.createElement("div");
    o.id="debug-output";
    o.innerHTML="output element";
    tabs.addTab('output panel',o);
    this.outputElement=$(o);

    if (this.debugPrefs.panelDisplayed)
      $('debug-panel').show();
    else
      $('debug-panel').hide();

  };
  this.clearCookies=function(){
    var cookies = document.cookie.split(';');

    for (var i=0;i<cookies.length;i++){
      // Some cookies can have no names. buggy.
      if (cookies[i].indexOf("=")<0)
         continue;

      var cookieName = cookies[i].match(/([^=]*)=/)[1];

      if (cookieName)
        Cookie.remove(cookieName);
    }
  };
  this.printCookies=function(){this.out(document.cookie);};
  /*
  * Used for continuous output; can optionally escape html characters
  */
  this.out=function(contents,childrenOnly, escapeHtml){
    if (Page.production || !this.debugPrefs.debugOutput)
      return;

    var html = DomPrinter.print(contents,childrenOnly);
    if (escapeHtml){
      // Don't want to insert html directly; want to put it in a text node so it gets escaped
      var tn = document.createTextNode(html);
      this.outputElement.appendChild(tn);
    }else{
      this.outputElement.innerHTML=html;
    }
  };
  this.outputObject=function(object,childrenOnly){
    var html = ObjectPrinter.print(object,childrenOnly);
    this.outputElement.innerHTML=html;
  };
  this.close=function(){
    //$('debug-panel').toggle();
    this.toggle();
    return false;
  };
  this.toggle=function(){
    $('debug-panel').toggle();
    var displayed = !($('debug-panel').style.display=="none");
    this.debugPrefs.panelDisplayed=displayed;
    this.savePrefs();

  };
  this.keydown=function(ev){
    // Safari can't read control keys. ctrl+d comes through as a non-printable character
    // in opera you need to hit meta; not sure why control D isn't working.
    if (ev.shift && (ev.control || ev.meta) && ev.key=="d"){
      this.toggle();
      ev.stop();
    }

  };
  this.addButton=function(caption, callback){
    var b = document.createElement("input");
    b.type="button";
    b.value=caption;
    b.onclick=callback;
    $('debug-options').appendChild(b);
  };

  /*
   * Add a bool option to the debug panel. Gets rendered as a checkbox
   * and its value is saved as a preference.
   */
  this.addBoolOption=function(name,caption){
    var checked = this.debugPrefs[name] ? true : false;

    var div = document.createElement("div");
    div.innerHTML=  input({name:name,type:"checkbox"}) + caption;
    var checkbox = div.getElementsByTagName("input")[0];
    checkbox.onchange=this.togglePref.bindAsEventListener(this);
    if (checked)
      checkbox.checked="true";
    $('debug-options').appendChild(div);

    this.debugPrefs[name]=checked;
  };
  /*
   * Event handler for when a pref is changed
   */
  this.togglePref=function(ev){
    ev=new Event(ev);
    var input = ev.target;
    var name = ev.target.name;
    if (input.type=="checkbox")
      this.setPref(name,input.checked);
  };
  this.getPref=function(name){
    return this.debugPrefs[name];
  };
  this.setPref=function(name,value){
    this.debugPrefs[name]=value;
    this.savePrefs();
  };
  /*
   * Parse debug preferences out of the cookie and store them in this.debugPrefs
   */
  this.parseCookie=function(){
    var cookie = Cookie.get('jjot-debug');
    if (!cookie)
      return;
    cookie=cookie.split(",");
    cookie = cookie[0] ? cookie : [];

    for (var i=0;i<cookie.length;i++){
      // split into key val
      var keyval = cookie[i].split('=');
      if (keyval[1]=="false")
        keyval[1]=false;
      this.debugPrefs[keyval[0]]=keyval[1];
    }
  };
  /*
   * Save all preferences to a cookie
   */
  this.savePrefs=function(){
    var prefs =[];
    for (key in this.debugPrefs)
      prefs.push(key + "=" + this.debugPrefs[key]);
    Cookie.set("jjot-debug",prefs.join(','), {duration:90, path:"/"});
  };
};


var TreePrinter=new Class({
  enableIndent:true,
  /*
  * Print a node and all its descendents.
  * childrenOnly: don't print the node we passed in; just its children
  */
  print:function(node,childrenOnly){
    this.tabIndex=0;
    this.output="";
    if (childrenOnly){
      this.printChildren(node);
    }else{
      this.printNode(node);
    }

    return this.output;
  },
  /*
  * write a line, including possible indentation
  */
  writeLine:function(text){
    var space="";
    if (this.enableIndent){
      for (var i=0;i<this.tabIndex*5;i++)
        space+="&nbsp;";
    }
    this.output += space + text;
    if (this.enableIndent)
      this.output+="<br/>";
  }
});

/*
* Pretty-prints DOM nodes, with optional indentation
*/
var DomPrinter=TreePrinter.extend({

  printNode:function(node){
    if (node.nodeType==1){
      this.printElement(node);
    }
    else if (node.nodeType==3){
      // When printing text nodes, print newlines as <br/>
      //var out = node.nodeValue.replace(/\n/g,"<br/>").replace(/ /g,"_");
      var out = node.nodeValue;
      this.writeLine(out);
    }
  },
  printChildren:function(node){
    var children = node.childNodes;
    this.tabIndex++;

    for (var i=0;i<children.length;i++)
      this.printNode(children[i]);

    this.tabIndex--;
  },
  /*
  * Prints any non-textnode element
  */
  printElement:function(node){
    var tag = node.tagName.toLowerCase();
    var attr=["id","className", "class","style","href"];
    if (tag=="br"){
      this.writeLine(this.brackets(tag+DomPrinter.attributeString(node,attr)+"/"));
      return;
    }else{
      this.writeLine(this.brackets(tag + DomPrinter.attributeString(node,attr)));
    }

    this.printChildren(node);

    this.writeLine(this.brackets(tag,true));
  },

  brackets:function(text,end){
    return "<span class='tag'>&lt;" + (end ? "/" : "") + text + "&gt;</span>";
  },
  elementToString:function(el){
    return this.brackets;
    // return "<"+o.tagName.toLowerCase()  + " " + this.attributeString(el,["id","className","style","href"])+">"
  },
  /* attributes should be an array of attributes */
  attributeString:function(node,attributeFilter){
    var result=[];
    var attr=node.attributes;

    for (var i=0;i<attr.length;i++){
      if (attributeFilter && !attributeFilter.indexOf(attr[i].nodeNode)) continue;

      var nv = attr[i].nodeValue;
      if (nv==null || nv=="" || $type(nv)=="function") continue;
      result.push(attr[i].nodeName + "=" + attr[i].nodeValue);
    }

    result=result.join(" ");
    if (result.length>0)
      return " "+result;
    return result;
  }
});

/*
 * Prints an object and all of its attributes
 */
var ObjectPrinter=TreePrinter.extend({
  printNode:function(node){
    this.printChildren(node);
  },
  printChildren:function(node){

    for (var key in node){
      try{
        this.writeLine("<span class='object-key'>" + key + "</span> : " + this.attributeString(node[key]));
      }catch(e){

      }
    }
  },
  attributeString:function(attr){
    if (typeof attr == "function")
      return "function()";
    else
      return attr.toString();
  }

});

DomPrinter = new DomPrinter();
ObjectPrinter = new ObjectPrinter();
