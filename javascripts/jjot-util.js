/*
 * Generic utility methods specific to jjot
 */

// Firefox 3 detection
var userAgent = navigator.userAgent.toString();
window.newFirefox = userAgent.indexOf("Firefox/3") >= 0 || userAgent.indexOf("Firefox/4") >=0 ? true : false;

/* Mods the action URL of a form, appending the value of a field to the end of the action URL.
 * Useful for our distributed server architecture, so the username
 * is in the url when we submit forms like "signup" and "signin"
 */
jjotutil={
	alterSubmitUrl:function(baseUrl,field){
		var f = $(field);
		f.form.action=baseUrl+f.value;
		f.form.submit();
	},
	// used for event handlers that you don't want to do anything. Using this can be nice
	// because it avoids creating a closure
	nullClick:function(){return false;}
};


/*
 * Returns the HTML for a grid layout
 * Usage:
 *
 * new TableLayout([cell1,cell2], [cell1,cell2])
*/
TableLayout={
	build:function(){
		var html = "<table>";
		for (var i=0;i<arguments.length;i++){
			html+="<tr>";
			for (var j=0;j<arguments[i].length;j++)
				html += td(arguments[i][j]);
			html+"</tr>";
		}
		html+="</table>";
		return html;
	}
};

/*
 * Extend anything with this object to give it the ability to listen for keyboard shortcuts
 * with terse syntax, like this.add(ctrl_alt_a, function(){})
 */
HotkeyManager = {
	/*
	 * Translates a keypress/keydown event into a string, like alt_ctrl_meta_enter
	 */
	keyToString:function(ev){
		var s ="";
		if (ev.alt) s+="alt_";
		if (ev.control) s+="ctrl_";
		if (ev.meta) s+="meta_";
		if (ev.shift) s+="shift_";
		s+= ev.key ? ev.key : ev.keyCode;
		return s;
	},
	/*
	 * evType: either keydown or keypress
	 * key: a key string, e.g. "alt_ctrl_meta_shift_1", or an array of keystrings
	 */
	add:function(evType,key,handler,options){
		if ($type(key)!="array") key = [key];

		key.each(function(k){
			this[evType][k]={h:handler,options:options};			
		}.bind(this));
	},

	/*
	 * Returns true if a keyhandler was found for the given key, false otherwise
	 *
	 * Be careful using this with addEvent(runHandlerForKey) in IE. Returning false seems to cancel the
	 * key even in IE (even if there's no registered handler for it), but not in other browsers.
	 */
	runHandlerForKey:function(ev){
		var k = this.keyToString(ev);

		// log("key:",k,ev,ev.type);
		// log(this[ev.type]);

		// this condition can be true if we're closing the window with ctrl+w
		if (!this[ev.type]) return;

		var f = this[ev.type][k];
		if (!f) return false;

		// have the handler handle this event, along with any other arguments passed to "run handler for key"
		f.h(ev,arguments[1]);
		// f.h(ev);
		// cancel by default, unless the handler says not to
		if (!f.options || f.options.cancel!=false)
			ev.stop();

		// true meaning we had a handler for this key
		return true;
	}	
};