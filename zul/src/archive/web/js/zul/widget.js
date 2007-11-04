/* widget.js

{{IS_NOTE
	Purpose:
		
	Description:
		
	History:
		Sun Jan 29 15:25:10     2006, Created by tomyeh
}}IS_NOTE

Copyright (C) 2006 Potix Corporation. All Rights Reserved.

{{IS_RIGHT
	This program is distributed under GPL Version 2.0 in the hope that
	it will be useful, but WITHOUT ANY WARRANTY.
}}IS_RIGHT
*/
zk.load("zul.vd");

////
// textbox //
zkTxbox = {};
zkau.textbox = zkTxbox; //zkau depends on it
zkTxbox._intervals = {};

zkTxbox.init = function (cmp) {
	zk.listen(cmp, "focus", zkTxbox.onfocus);
	zk.listen(cmp, "blur", zkTxbox.onblur);
	zk.listen(cmp, "select", zkTxbox.onselect);
	if ($tag(cmp) == "TEXTAREA")
		zk.listen(cmp, "keyup", zkTxbox.onkey);

	//Bug 1486556: we have to enforce zkTxbox to send value back for validating
	//at the server
	if (getZKAttr($outer(cmp), "srvald")) {
		var old = cmp.value;
		cmp.defaultValue = old + "-";
		if (old != cmp.value) cmp.value = old; //Bug 1490079
	}
};
zkTxbox.onHide = function (cmp) {
	var inp = $real(cmp);
	if (inp) zkVld.closeErrbox(inp.id, true);
};

zkTxbox.onselect = function (evt) {
	var inp = zkau.evtel(evt); //backward compatible (2.4 or before)
	var cmp = $outer(inp);
	if (zkau.asap(cmp, "onSelection")) {
		var sr = zk.getSelectionRange(inp);
		zkau.send({uuid: cmp.id, cmd: "onSelection",
				data: [sr[0], sr[1], inp.value.substring(sr[0], sr[1])]},
    	 	100);
    }
};
/** Handles onblur for text input.
 * Note: we don't use onChange because it won't work if user uses IE' auto-fill
 */
zkTxbox.onblur = function (evt) {
	var inp = zkau.evtel(evt); //backward compatible (2.4 or before)

	//stop the scanning of onChaning first
	var interval = zkTxbox._intervals[inp.id];
	if (interval) {
		clearInterval(interval);
		delete zkTxbox._intervals[inp.id];
	}
	if (inp.removeAttribute) {
		inp.removeAttribute("zk_changing_last");
		inp.removeAttribute("zk_changing_selbk");
	}

	zkTxbox.updateChange(inp, zkTxbox._noonblur(inp));
	zkau.onblur(evt); //fire onBlur after onChange
};
/** check any change.
 * @return false if failed (wrong data).
 */
zkTxbox.updateChange = function (inp, noonblur) {
	if (zkVld.validating) return true; //to avoid deadloop (when both fields are invalid)

	if (inp && inp.id) {
		var msg = !noonblur ? zkVld.validate(inp.id): null;
			//It is too annoying (especial when checking non-empty)
			//if we alert user for something he doesn't input yet
		if (msg) {
			zkVld.errbox(inp.id, msg);
			inp.setAttribute("zk_err", "true");
			zkau.send({uuid: $uuid(inp), cmd: "onError",
				data: [inp.value, msg]}, -1);
			return false; //failed
		}
		zkVld.closeErrbox(inp.id);
	}

	if (!noonblur) zkTxbox.onupdate(inp);
	return true;
};

/** Tests whether NOT to do onblur (if inp currentFocus are in the same
 * component).
 */
zkTxbox._noonblur = function (inp) {
	var cf = zkau.currentFocus;
	if (inp && cf && inp != cf) {
		var el = inp;
		for (;; el = el.parentNode) {
			if (!el) return false;
			if (getZKAttr(el, "combo") == "true")
				break;
			if (getZKAttr(el, "type"))
				return false;
		}

		for (; cf; cf = $parent(cf))
			if (cf == el)
				return true;
	}
	return false;
};

/** Called if a component updates a text programmingly. Eg., datebox.
 * It checks whether the content is really changed and sends event if so.
 */
zkTxbox.onupdate = function (inp) {
	var newval = inp.value;
	if (newval != inp.defaultValue) { //changed
		inp.defaultValue = newval;
		var uuid = $uuid(inp);
		zkau.send({uuid: uuid, cmd: "onChange",
			data: [newval]}, zkau.asapTimeout(uuid, "onChange", 100));
	} else if (inp.getAttribute("zk_err")) {
		inp.removeAttribute("zk_err");
		zkau.send({uuid: $uuid(inp), cmd: "onError",
			data: [newval, null]}, -1); //clear error (even if not changed)
	}
};
zkTxbox.onkey = function (evt) {
	//Request 1565288 and 1738246: support maxlength for Textarea
	var inp = Event.element(evt);
	var maxlen = getZKAttr(inp, "maxlen");
	if (maxlen) {
		maxlen = $int(maxlen);
		if (maxlen > 0 && inp.value != inp.defaultValue
		&& inp.value.length > maxlen)
			inp.value = inp.value.substring(0, maxlen);
	}
};
zkTxbox.onfocus = function (evt) {
	zkau.onfocus(evt);

	//handling onChanging
	var inp = zkau.evtel(evt); //backward compatible (2.4 or before)
	if (inp && inp.id && zkau.asap($outer(inp), "onChanging")) {
		inp.setAttribute("zk_changing_last", inp.value);
		if (!zkTxbox._intervals[inp.id])
			zkTxbox._intervals[inp.id] =
				setInterval("zkTxbox._scanChanging('"+inp.id+"')", 500);
	}
};
/** Scans whether any changes. */
zkTxbox._scanChanging = function (id) {
	var inp = $e(id);
	if (inp && zkau.asap($outer(inp), "onChanging")
	&& inp.getAttribute("zk_changing_last") != inp.value) {
		inp.setAttribute("zk_changing_last", inp.value);
		var selbk = inp.getAttribute("zk_changing_selbk");
		inp.removeAttribute("zk_changing_selbk");
		zkau.send({uuid: $uuid(id),
			cmd: "onChanging", data: [inp.value, selbk == inp.value],
			ignorable: true}, 100);
	}
};
zkTxbox.setAttr = function (cmp, nm, val) {
	if("z.sel" == nm){
		var inp = $real(cmp);
		if ("all" == val) {
			zk.asyncSelect(inp.id);
			return true; //done
		}

		var ary = val.split(",");
		var start = $int(ary[0]), end = $int(ary[1]),
			len = inp.value.length;
		if (start < 0) start = 0;
		if (start > len) start = len;
		if (end < 0) end = 0;
		if (end > len) end = len;
		
		if (inp.setSelectionRange) {
			inp.setSelectionRange(start, end);
			inp.focus();
		} else if (inp.createTextRange) {
			var range = inp.createTextRange();
			if(start != end){
				range.moveEnd('character', end - range.text.length);
				range.moveStart('character', start);
			}else{
				range.move('character', start);
			}
			range.select();
		}
		return true;
	}
	return false;
}
////
//intbox//
zkInbox = {};
zkInbox.init = zkTxbox.init;
zkInbox.setAttr = zkTxbox.setAttr ;
zkInbox.onHide = zkTxbox.onHide;
zkInbox.validate = function (cmp) {
	return zkVld.onlyInt(cmp.id);
};

////
//decimalbox//
zkDcbox = {};
zkDcbox.init = zkTxbox.init;
zkDcbox.setAttr = zkTxbox.setAttr ;
zkDcbox.onHide = zkTxbox.onHide;
zkDcbox.validate = function (cmp) {
	return zkVld.onlyNum(cmp.id);
};

////
//doublebox//
zkDbbox = {};
zkDbbox.init = zkTxbox.init;
zkDbbox.setAttr = zkTxbox.setAttr ;
zkDbbox.onHide = zkTxbox.onHide;
zkDbbox.validate = function (cmp) {
	return zkVld.onlyNum(cmp.id);
};

////
// button //
zkButton = {};
zkButton.init = function (cmp) {
	zk.listen(cmp, "click", zkau.onclick);
	zk.listen(cmp, "dblclick", zkau.ondblclick);
		//we have to handle here since _onDocDClick won't receive it
	zk.listen(cmp, "focus", zkau.onfocus);
	zk.listen(cmp, "blur", zkau.onblur);
};

zkTbtn = {}; //toolbarbutton
zkTbtn.init = function (cmp) {
	zk.listen(cmp, "click", function (evt) {
		if ("javascript:;" == cmp.href) zkau.onclick(evt);
		else {
			var t = cmp.getAttribute("target");
			if (cmp.href && !zk.isNewWindow(cmp.href, t))
				zk.progress();
		}
	});
	zk.listen(cmp, "focus", zkau.onfocus);
	zk.listen(cmp, "blur", zkau.onblur);
};

////
// checkbox and radio //
zkCkbox = {};
zkCkbox.init = function (cmp) {
	cmp = $real(cmp);
	zk.listen(cmp, "click", function () {zkCkbox.onclick(cmp);});
	zk.listen(cmp, "focus", zkau.onfocus);
	zk.listen(cmp, "blur", zkau.onblur);
};
zkCkbox.setAttr = function (cmp, nm, val) {
	if ("style" == nm) {
		var lbl = zk.firstChild(cmp, "LABEL", true);
		if (lbl) zkau.setAttr(lbl, nm, zk.getTextStyle(val));
	}
	zkau.setAttr(cmp, nm, val);
	return true;
};
zkCkbox.rmAttr = function (cmp, nm) {
	if ("style" == nm) {
		var lbl = zk.firstChild(cmp, "LABEL", true);
		if (lbl) zkau.rmAttr(lbl, nm);
	}
	zkau.rmAttr(cmp, nm);
	return true;
};

zkRadio = {};
zkRadio.init = zkCkbox.init;
zkRadio.setAttr = zkCkbox.setAttr;
zkRadio.rmAttr = zkCkbox.rmAttr;

/** Handles onclick for checkbox and radio. */
zkCkbox.onclick = function (cmp) {
	var newval = cmp.checked;
	//20060426: if radio, we cannot detect whether a radio is unchecked
	//by the browser -- so always zk.send
	if (cmp.type == "radio" || newval != cmp.defaultChecked) { //changed
		cmp.defaultChecked = newval;
		var uuid = $uuid(cmp);
		zkau.send({uuid: uuid, cmd: "onCheck", data: [newval]},
			zkau.asapTimeout(uuid, "onCheck"));
	}
};

////
// groupbox, caption //
zkGrbox = {};
zkCapt = {};

zkGrbox.init = zkGrbox._fixHgh = function (cmp) {
	var n = $e(cmp.id + "!cave");
	if (n) {
		var hgh = cmp.style.height;
		if (hgh && hgh != "auto") {
			hgh = cmp.clientHeight;
			for (var p = n, q; q = p.previousSibling;) {
				if (q.offsetHeight) hgh -= q.offsetHeight;
				p = q;
			}
			for (var p = n, q; q = p.nextSibling;) {
				if (q.offsetHeight) hgh -= q.offsetHeight;
				p = q;
			}
			zk.setOffsetHeight(n, hgh);
		}

		//if no border-bottom, hide the shadow
		var sdw = $e(cmp.id + "!sdw");
		if (sdw) {
			var w = $int(Element.getStyle(n, "border-bottom-width"));
			sdw.style.display = w ? "": "none";
		}
	}

};
zkGrbox.setAttr = function (cmp, nm, val) {
	switch (nm) {
	case "z.open":
		zkGrbox.open(cmp, val == "true", true);
		return true; //no need to store z.open

	case "z.cntStyle":
		var n = $e(cmp.id + "!cave");
		if (n) {
			zk.setStyle(n, val != null ? val: "");
			zkGrbox._fixHgh(cmp);
		}
		return true; //no need to store z.cntType
	case "z.cntScls":
		var n = $e(cmp.id + "!cave");
		if (n) {
			n.className = val != null ? val: "";
			zkGrbox._fixHgh(cmp); //border's dimension might be changed
		}
		return true; //no need to store it

	case "style":
	case "style.height":
		zkau.setAttr(cmp, nm, val);
		zkGrbox._fixHgh(cmp);
		return true;
	}
	return false;
};
zkGrbox.onclick = function (evt, uuid) {
	if (!evt) evt = window.event;

	var target = Event.element(evt);
	var tn = $tag(target);
	if ("BUTTON" == tn || "INPUT" == tn || "TEXTAREA" == tn || "SELECT" == tn
	|| "A" == tn || ("TD" != tn && "TR" != tn && target.onclick))
		return;

	if (uuid) {
		var cmp = $e(uuid);
		if (getZKAttr(cmp, "closable") == "false")
			return;

		cmp = $e(uuid + "!slide");
		if (cmp)
			zkGrbox.open(uuid, !$visible(cmp));
	}
};
zkGrbox.open = function (gb, open, silent) {
	var gb = $e(gb);
	if (gb) {
		var panel = $e(gb.id + "!slide");
		if (panel && open != $visible(panel)
		&& !panel.getAttribute("zk_visible")) {
			if (open) anima.slideDown(panel);
			else anima.slideUp(panel);

			if (!silent)
				zkau.send({uuid: gb.id, cmd: "onOpen", data: [open]},
					zkau.asapTimeout(gb, "onOpen"));

			setTimeout(function() {zkGrbox._fixHgh(gb);}, 500); //after slide down
		}
	}
};

zkCapt.init = function (cmp) {
	var gb = zkCapt._parentGrbox(cmp);
	cmp = cmp.rows[0]; //first row
	if (gb && cmp) {
		zk.listen(cmp, "click",
			function (evt) {zkGrbox.onclick(evt, gb.id);});
	}
};
zkCapt._parentGrbox = function (p) {
	while (p = p.parentNode) { //yes, assign
		var type = $type(p);
		if (type == "Grbox") return p;
		if (type) break;
	}
	return null;
};

////
// Image//
zkImg = {};

if (zk.ie && !zk.ie7) {
	//Request 1522329: PNG with alpha color in IE
	//To simplify the implementation, Image.java invalidates instead of smartUpdate
	zkImg.init = function (cmp) {
		return zkImg._fixpng(cmp);
	};
	zkImg._fixpng = function (img) {
		if (img.getAttribute("zk_alpha") && img.src
		&& img.src.toLowerCase().endsWith(".png")) {
			var id = img.id;
			var wd = img.width, hgh = img.height;
			if (!wd) wd = img.offsetWidth;
			if (!hgh) hgh = img.offsetHeight;

			var commonStyle = "width:"+wd+"px;height:"+hgh+"px;";
			if (img.hspace) commonStyle +="margin-left:"+img.hspace+"px;margin-right:"+img.hspace+"px;";
			if (img.vspace) commonStyle +="margin-top:"+img.vspace+"px;margin-bottom:"+img.vspace+"px;";
			commonStyle += img.style.cssText;

			var html = '<span id="'+id
				+'" style="filter:progid:DXImageTransform.Microsoft.AlphaImageLoader(src=\''
				+img.src+"', sizingMethod='scale');display:inline-block;";
			if (img.align == "left") html += "float:left;";
			else if (img.align == "right") html += "float:right;";
			if ($tag(img.parentNode) == "A") html += "cursor:hand;";
			html += commonStyle+'"';
			if (img.className) html += ' class="'+img.className+'"';
			if (img.title) html += ' title="'+img.title+'"';

			//process zk_xxx
			for (var attrs = img.attributes, j = 0; j < attrs.length; ++j) {
				var attr = attrs.item(j);
				if (attr.name.startsWith("z."))
					html += ' '+attr.name+'="'+attr.value+'"';
			}

			html += '></span>';

			if (img.isMap) {
				html += '<img style="position:relative;left:-'+wd+'px;'+commonStyle
					+'" src="'+zk.getUpdateURI('/web/img/spacer.gif')
					+'" ismap="ismap"';
				if (img.useMap) html += ' usemap="'+img.useMap+'"';
				html += '/>';
			}
			img.outerHTML = html;
			return $e(id); //transformed
		}
	}
}

////
// Imagemap //
zkMap = {};
zkArea = {};

zkMap.init = function (cmp) {
	zk.newFrame("zk_hfr_",
		null, zk.safari ? "width:0;height:0;display:inline": "display:none");
		//creates a hidden frame. However, in safari, we cannot use invisible frame
		//otherwise, safari will open a new window
	if (zk.ie && !zk.ie7) {
		var img = $real(cmp);
		return zkImg._fixpng(img);
	}
};
zkArea.init = function (cmp) {
	var map = $parentByType(cmp, "Map");
	var img = $real(map);
	if (img && !img.useMap)
		img.useMap = "#" + map.id + "_map";
};
zkArea.cleanup = function (cmp) {
	if (cmp.parentNode.areas.length <= 1) { //removing the last area
		var img = $real($parentByType(cmp, "Map"));
		if (img) img.useMap = "";
			//Safari bug not solved yet: once useMap is cleaned up, ismap won't
			//fall back to no-useMap
	}
};

/** Called when an area is clicked. */
zkArea.onclick = function (id) {
	if (zkMap._toofast()) return;

	var cmp = $e(id);
	if (cmp) {
		var map = $parentByType(cmp, "Map");
		if (map)
			zkau.send({uuid: map.id,
				cmd: "onClick", data: [getZKAttr(cmp, "aid")], ctl: true});
	}
};
/** Called by map-done.dsp */
zkMap.onclick = function (href) {
	if (zkMap._toofast()) return;

	var j = href.indexOf('?');
	if (j < 0) return;

	var k = href.indexOf('?', ++j);
	if (k < 0 ) return;

	var id = href.substring(j, k);
	if (!$e(id)) return; //component might be removed

	j = href.indexOf(',', ++k);
	if (j < 0) return;

	var x = href.substring(k, j);
	var y = href.substring(j + 1);
	zkau.send({uuid: id, cmd: "onClick", data: [x, y], ctl: true});
};
zkMap._toofast = function () {
	if (zk.gecko) { //bug 1510374
		var now = $now();
		if (zkMap._stamp && now - zkMap._stamp < 800)
			return true;
		zkMap._stamp = now;
	}
	return false
}

//progressmeter//
zkPMeter = {};
zkPMeter.init = function (cmp) {
	var img = $e(cmp.id + "!img");
	if (img) {
		var val = $int(getZKAttr(cmp, "value"));
		img.style.width = Math.round((cmp.clientWidth * val) / 100) + "px";
	}
};
zkPMeter.setAttr = function (cmp, nm, val) {
	zkau.setAttr(cmp, nm, val);
	if ("z.value" == nm)
		zkPMeter.init(cmp);
	return true;
}

//Paging//
zkPg = {};
zkPg.go = function (anc, pgno) {
	var cmp = $parentByType(anc, "Pg");
	if (cmp)
		zkau.send({uuid: cmp.id, cmd: "onPaging", data: [pgno]});
};

//popup//
zkPop = {};

/** Called by au.js's context menu. */
zkPop.context = function (ctx, ref) {
	zk.show(ctx); //onVisiAt is called in zk.show
	zkPop._pop.addFloatId(ctx.id, true); //it behaves like Popup (rather than dropdown)
	zkau.hideCovered();

	if (zkau.asap(ctx, "onOpen"))
		zkau.send({uuid: ctx.id, cmd: "onOpen", data: [true, ref.id]});
};
zkPop.close = function (ctx) {
	zkPop._pop.removeFloatId(ctx.id);
	zkPop._close(ctx);
};
zkPop._close = function (ctx) {
	ctx.style.display = "none";
	zk.unsetVParent(ctx);
	zkau.hideCovered();

	if (zkau.asap(ctx, "onOpen"))
		zkau.send({uuid: ctx.id, cmd: "onOpen", data: [false]});
};

zk.Popup = Class.create();
Object.extend(Object.extend(zk.Popup.prototype, zk.Floats.prototype), {
	_close: function (el) {
		zkPop._close(el);
	}
});
if (!zkPop._pop)
	zkau.floats.push(zkPop._pop = new zk.Popup()); //hook to zkau.js

//iframe//
if (zk.gecko) { //Bug 1692495
	zkIfr = {}

	zkIfr.onVisi = function (cmp) {
		if (cmp.src.indexOf(".xml") >= 0)
			cmp.src = cmp.src; //strange workaround: reload xml
	};
}

//utilities//
var zkWgt = {}
/** Fixes the button align with an input box, such as combobox, datebox.
 */
zkWgt.fixDropBtn = function (cmp) {
	//Bug 1752477: we have to delay it for sophisticated layout in IE
	var cmp = $e(cmp);
	if (cmp)
		setTimeout("zkWgt._fixdbtn($e('" + cmp.id +"'))", 66);
};
zkWgt._fixdbtn = function (cmp) {
	cmp = $e(cmp);
	if (!cmp) return; //it might be gone if the user press too fast

	var inp = $real(cmp);
	var btn = $e(cmp.id + "!btn");
	//note: isRealVisible handles null argument
	if (zk.isRealVisible(btn) && btn.style.position != "relative") {
		if (!inp.offsetHeight || !btn.offsetHeight) {
			zkWgt.fixDropBtn(cmp);
			return;
		}

		//Bug 1738241: don't use align="xxx"
		var v = inp.offsetHeight - btn.offsetHeight;
		if (v > 0) {
			var v2 = Math.round(v/2); //yes, round to integer
			btn.style.paddingTop = v2 + "px";
			btn.style.paddingBottom = (v - v2) + "px";
		}

		v = inp.offsetTop - btn.offsetTop;
		btn.style.position = "relative";
		btn.style.top = v + "px";
		if (zk.safari) btn.style.left = "-2px";
	}
};
