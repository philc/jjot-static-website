/*
 * General utility functions, and useful extensions to various classes, including some from Mootools.
 * More specialized stuff gets put in dom.xx.js files
 * Author: Phil Crosby
 */

/*
 * Small utility methods
 */
util={
	timeInSeconds:function(){
		return Math.round((new Date()).getTime()/1000);
	},
	/* keys of a hash */
	keys:function(obj){
		var a = [];
		for (k in obj) a.push(k);
		return a;
	},
	escapeHTML:function(html){
		return html.replace(/</g,"&lt;").replace(/>/g,'&gt;');
	},
	unescapeHTML:function(text){
		return text.replace(/&lt;/g,"<").replace(/&gt;/g,">");
	},
	/*
	* Old fashioned event attach function
	*/
	attach:function(element,ev,fn){
		if (element.addEventListener)
			element.addEventListener(ev, fn, false);
		else 
			element.attachEvent('on'+ev, fn);
	},
	/* 
	 * adds two numbers and enforces a limit. This is trivial with positive numbers (a+c%m)
	 * but it takes a extra bit of code for negative numbers, which is why it's in util.
	 * Plus doing this op with long var names can be disgusting
	 * e.g. mod(5,5,1) => 0
	 * mod(0,5,-1) => 5
	 */	
	mod:function(i,limit,amt){
		i+=amt; return i<0 ? limit+(i%limit) : i%limit;
	},
	/*
	 * IE re-requests background images on elements when they're redrawn
	 * http://www.bazon.net/mishoo/articles.epl?art_id=958
	 */
	disableIECaching:function(){
		if (document.execCommand){
			try { document.execCommand("BackgroundImageCache",false,true); }
			catch (e) { }
		}
	}
};
// Disable caching immediately
util.disableIECaching();


/*
 * Adds the given methods to the object, if the methods doesn't already eixst.
 *   methods: { methodName:function(){... } }
 */
function extendIfAbsent(cls, methods){
	for (m in methods)
		if (!cls[m]) cls[m]=methods[m];
};


/*
* Logging
* what we want to do here is disable logging entirely in production.
* in development, if it's firebug, log to that. If not (e.g. we're deving
* in IE or safari) use a custom logger
*/
if(typeof console == "undefined")	console = { log: function(){} };
log = function(){	console.log.apply(console, arguments); };


/*
 * Garbage collection
 * Register a function to clean up your object by calling GC.run(myFunc)
 */
GC={
	funcs:[],
	run:function(func){
		GC.funcs.push(func);
	},
	cleanup:function(){
		for (var i=0;i<GC.funcs.length;i++)
			GC.funcs[i].call();
	}
};
window.addEvent("unload",GC.cleanup);


/*
 * String
 */
extendIfAbsent(String.prototype,{
	startsWith: function(word){ 
		return this.indexOf(word) == 0;	
	},
	endsWith: function(word){
		var i = this.indexOf(word);
		return (i>=0 && i>=this.length-word.length);
	},
	truncate: function(n){
		if (this.length<=n) return this.toString();
		return this.toString().substring(0,n-1) + "..";
	},
	/*
	 * e.g. "abcd".containsAny("f,g") => false
	 */
	containsAny:function(){
		return $A(arguments).filter(function(a){ return this.indexOf(a)>=0;}.bind(this)).length>0;
	},
	empty:function(){
		return this.trim().length==0;
	}
});


/*
 * Benchmarking
 */
bm = function(fn,times){
	times = times || 1;
	var s = (new Date()).getTime();
	for (var i=0;i<times;i++)
		fn();
	var e = (new Date()).getTime();
	return e-s;
};

/*
 * Escapes a user-provided regex.. Is this in Mootools 1.1, on String?
 * http://simonwillison.net/2006/Jan/20/escape/
*/
RegExp.escape = function(text) {
	if (!arguments.callee.sRE) {
		var specials = [
		'/', '.', '*', '+', '?', '|',
		'(', ')', '[', ']', '{', '}', '\\'
		];
		arguments.callee.sRE = new RegExp(
			'(\\' + specials.join('|\\') + ')', 'g'
		);
	}
	return text.replace(arguments.callee.sRE, '\\$1');
};



/*
 * OS detection detection
 * Mootools gives you browser detection only
 */
if (navigator.appVersion.contains("Win")) window.OS="Windows";
else if (navigator.appVersion.contains("Mac")) window.OS="MacOS";
else window.OS="Linux";