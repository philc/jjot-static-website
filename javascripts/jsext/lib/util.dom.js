/*
* Lots of dom functions
*/
util = util || {};

/*
* Finds the offset of a node from its parent, counting only siblings of 
* the given tag name
*/
util.dom={
	/*
	* True if the first node descends from the second
	*/
	descendsFrom:function(node,parent){
		while (node!=null && node!=parent)
			node=node.parentNode;

		return node!=null;
	},
	findParentWithClass:function(node,className){
		while (node!=null && (!node.className || !node.className.contains(className, ' ')))
			node=node.parentNode;
		return node;
	},
	indexOfChildByTagName:function(node, tagName){
		var firstChild=node.parentNode.firstChild;
		var i=0;
		while (firstChild!=node)
		{
			if (!tagName || (firstChild.tagName && firstChild.tagName==tagName))
				i++;
			firstChild=firstChild.nextSibling;
		}
		return i;
	},
	/* 
	* Finds the index of the child from its parent.
	*/
	indexOfChild:function(node){
		var p = node.parentNode;
		for (var i=0; i < p.childNodes.length; i++) 
			if (p.childNodes[i] == node) return i;
		return null;
	},
	removeClass:function(elems, className){
		for (var i=0;i<elems.length;i++)
			$(elems[i]).removeClass(className);
	},
	// childrenWithClassName:function(el,className){
	// 	return $(el).getChildren().filter(function(e){ return e.className.contains(className);});
	// },
	// This only searches an element's immediate children
	childrenWithTagName:function(parent, tagName){
		var kids = parent.childNodes;
		var results =[];
		for (var i=0;i<kids.length;i++)
			if (kids[i].tagName==tagName) results.push(kids[i]);
		return results;
	},
	/*
	 * Return the html of a documentFragment, which doesn't support innerHTML
	 */
	fragmentInnerHTML:function(df){
		var childNodes;
		// IE can throw an exception here
		try{
			childNodes = df.childNodes;
		}catch(e){
			// we have just a single text node
			return df.firstChild.nodeValue;
		}


		var els=[];
		for (var i=0;i<childNodes.length;i++){
			var e = childNodes[i];
			if (this.isText(e)){
				els.push(e.nodeValue);
				continue;
			}
			var attrString=[];

			// IE will give you _all_ of the properties declared on the element, even arbitrary javascript ones.
			// That's like 100 per element -- even if we only process properties that are non-empty strings,
			// it's still a lot. So instead we're going to ask only for properties that we care about
			if (window.ie){
				var props=["href","name","id","src","style","type"];	//"valign",
				for (var j=0;j<props.length;j++){
					var v = e.getAttribute(props[j]);
					if (!v || v.nodeValue==undefined) continue;
					if (typeof v.nodeValue=="string" || v.nodeValue!="")
						attrString.push(v.nodeName + '="' + v.nodeValue + '"');
				}
				// also translate className into class
				if (e.className!="")
					attrString.push("class='" + e.className + "'");
			}else{
				for (var j=0;j<e.attributes.length;j++){
					// IE can give us tons of bogus attribute values. It lists _everything_ as an attribute. Filter them out
					var v = e.attributes[j].nodeValue;
					if (e.attributes[j].nodeValue!="") 
						attrString.push(e.attributes[j].nodeName + '="' + e.attributes[j].nodeValue + '"');
				}
			}
			
			var tag = e.tagName.toLowerCase();
			// first part of the tag
			var html = "<"+tag +" " + attrString.join(" ")

			if (this.isChildless(e))
				html += "/>";
			else
				html += ">" + e.innerHTML + "</" + tag + ">";

			els.push(html);
		}
		return els.join("");

	},
	/* used by fragmentInnerHTML */
	isChildless: function(node) {
		switch (node.nodeName.toLowerCase()) {
			case 'img':
			case 'br':
			case 'hr':
				return true;
		}
		return false;
	},
	isText:function(node){
		return node.nodeType==3;
	}
};