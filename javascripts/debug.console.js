/*
* Console to log to. Good for when you don't have firebug
*/
Debug.Console={
	init:function(){
		// create the HTML chunk

		var d = document.createElement("div");
		d.innerHTML='<div id="debug-eval"><span class="caret">&gt;&gt; </span><input type="text" id="debug-eval-box"></input>' + 
			'<span id="debug-eval-buttons"><input class="clear" type="button" value="clear"><input class="clear" type="button" value="exec"></input>' + 
			' <input class="help" type="button" value="?"></input></span></div>';

		var inputs = $ES('input',d);
		Debug.Eval.init(inputs[0]);

		inputs[1].onclick=this.clear;
		inputs[2].onclick=Debug.Eval.evaluate.bind(Debug.Eval);
		var log = document.createElement("div");
		log.id="debug-log";
		d.appendChild(log);

		this.element=d;
	},
	clear:function(){
		$('debug-log').innerHTML="";
	},
	log:function(){
		var d = document.createElement('div');
		d.className="log-line";
		for (var i=0;i<arguments.length;i++){
			var a = arguments[i];
			Debug.Console.addLogLine(a);
			d.appendChild(Debug.Console.addLogLine(a));
		}
		var s = $(Debug.Console.element).getSize();

		$('debug-log').appendChild(d);

		// Scroll to the bottom of the log window. You can't invoke this right away,
		// because safari is slow to append the element to the DOM, so it won't
		// scroll past the last element we just added
		// var f=function(){$(Debug.Console.element.parentNode).scrollTo(false, s.scrollSize.y+500);};
		// f.delay(20);
		// above would be what we want if we were scrolling the tab itself instead of the log window
		var s = $('debug-log').getSize();
		var f=function(){$('debug-log').scrollTo(false, s.scrollSize.y+500);};
		f.delay(20);

	},
	addLogLine:function(o){
		var e;
		if (o==null)
			return this.textElement("null ");
		var t = $type(o);
		switch(t){
			case "string":
			var str = (o=="") ? "\"\"" : o;				
			e = this.textElement(str + " ");
			break;
			case "function":
			e = this.textElement("function() ");
			break;
			case "undefined":
			e = this.textElement("undefined ");
			break;
			case "element":
			var s = this.elementToString(o);
			return this.textElement(s);
			break;
			case "object":
			e = document.createElement("a");
			e.href="#";
			e.innerHTML=Debug.Console.objectToString(o) + " ";
			e.onclick=function(){Debug.outputObject(o);return false;};
			break;

			default:
			e=this.textElement(o.toString() + " ");
		}

		return e;
	},
	elementToString:function(el){
		return "<"+el.tagName.toLowerCase()  + " " + DomPrinter.attributeString(el,["id","className","style","href"])+">";
	},
	objectToString:function(o){
		if (o instanceof Error){
			return "<span class='error'>Error: " + o.message + "</span>";
		}else if (o instanceof Array){
			// better way to do this, e.g. we should print "Document main" instead of [object..]
			// if one of the array elements is an object
			return "[" + o.join(", ") + "]";
		}else{
			// Get the first 3 non-function attributes of this object and print them,
			// e.g. {a:1,b:2,c:3} should print as "Object a=1 b=2 c=3"
			var count =0;
			var props=[];
			for (var k in o){
				if (typeof o[k] != "function"){
					props.push(k);
					count++;
				}
				if (count>=3)
					break;
			}
			var str ="Object ";
			for (var i=0;i<count;i++)
				str+=props[i] + "=" + o[props[i]] + " ";
			return str;
			return o.toString();
		}
	},
	textElement:function(text){
		return document.createTextNode(text);
	}	
};

Debug.Eval={
	init:function(evalBox){
		$(evalBox).addEvent('keypress',this.keypress.bindWithEvent(this.keypress,this));
	},
	keypress:function(ev){
		if (ev.key=="enter"){
			ev.stop();
			Debug.Eval.evaluate();
		}
	},
	evaluate:function(){
		var js = $('debug-eval-box').value.trim();
		if (js=="")
			return;

		// try{
			log(eval(js));
		// }catch(e){
			// log(e);
		// }

	}
};