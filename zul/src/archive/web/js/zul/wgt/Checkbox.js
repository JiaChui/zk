/* Checkbox.js

	Purpose:

	Description:

	History:
		Wed Dec 10 16:17:14     2008, Created by jumperchen

Copyright (C) 2008 Potix Corporation. All Rights Reserved.

This program is distributed under LGPL Version 2.1 in the hope that
it will be useful, but WITHOUT ANY WARRANTY.
*/
(function () {
	//Two onclick are fired if clicking on label, so ignore it if so
	function _shallIgnore(evt) {
		var v = evt.domEvent;
		return v && jq.nodeName(v.target, 'label');
	}

var Checkbox =
/**
 * A checkbox.
 *
 * <p>Event:
 * <ol>
 * <li>onCheck is sent when a checkbox
 * is checked or unchecked by user.</li>
 * </ol>
 */
zul.wgt.Checkbox = zk.$extends(zul.LabelImageWidget, {
	//_tabindex: 0,
	_checked: false,
	_disabled: false,

	$define: {
		/** Returns whether it is disabled.
		 * <p>Default: false.
		 * @return boolean
		 */
		/** Sets whether it is disabled.
		 * @param boolean disabled
		 */
		disabled: [
			function (v, opts) {
				if (opts && opts.adbs)
					// called from zul.wgt.ADBS.autodisable
					this._adbs = true;	// Start autodisabling
				else if (!opts || opts.adbs === undefined)
					// called somewhere else (including server-side)
					this._adbs = false;	// Stop autodisabling
				if (!v) {
					if (this._adbs) {
						// autodisable is still active, allow enabling
						this._adbs = false;
					} else if (opts && opts.adbs === false)
						// ignore re-enable by autodisable mechanism
						return this._disabled;
				}
				return v;
			},
			function (v) {
				var n = this.$n('real');
				if (n) {
					n.disabled = v;
					if (!this._isDefaultMold()) {
						jq(this.$n()).toggleClass(this.$s(this.getMold() + '-disabled'), v);
						this._setTabIndexForMold();
					}
				}
			}
		],
		/** Returns whether it is checked.
		 * <p>Default: false.
		 * @return boolean
		 */
		/** Sets whether it is checked,
		 * changing checked will set indeterminate to false.
		 * @param boolean checked
		 */
		checked: function (v) {
			var n = this.$n('real');
			if (n) {
				//B70-ZK-2057: prop() method can access right property values;
				jq(n).prop('checked', v);
				if (!this._isDefaultMold()) {
					var mold = this.getMold();
					jq(this.$n())
						.toggleClass(this.$s(mold + '-on'), v)
						.toggleClass(this.$s(mold + '-off'), !v);
				}
			}
		},
		/** Returns the name of this component.
		 * <p>Default: null.
		 * <p>Don't use this method if your application is purely based
		 * on ZK's event-driven model.
		 * <p>The name is used only to work with "legacy" Web application that
		 * handles user's request by servlets.
		 * It works only with HTTP/HTML-based browsers. It doesn't work
		 * with other kind of clients.
		 * @return String
		 */
		/** Sets the name of this component.
		 * <p>Don't use this method if your application is purely based
		 * on ZK's event-driven model.
		 * <p>The name is used only to work with "legacy" Web application that
		 * handles user's request by servlets.
		 * It works only with HTTP/HTML-based browsers. It doesn't work
		 * with other kind of clients.
		 *
		 * @param String name the name of this component.
		 */
		name: function (v) {
			var n = this.$n('real');
			if (n) n.name = v || '';
		},
		/** Returns the tab order of this component.
		 * <p>Default: -1 (means the same as browser's default).
		 * @return int
		 */
		/** Sets the tab order of this component.
		 * @param int tabindex
		 */
		tabindex: function (v) {
			var n = this.$n('real');
			if (n) {
				if (tabindex == null)
					n.removeAttribute('tabindex');
				else
					n.tabIndex = v;
			}
		},
		/** Returns the value.
		 * <p>Default: "".
		 * @return String
		 * @since 5.0.4
		 */
		/** Sets the value.
		 * @param String value the value; If null, it is considered as empty.
		 * @since 5.0.4
		 */
		value: function (v) {
			var n = this.$n('real');
			if (n) n.value = v || '';
		},
		/** Returns a list of checkbox component IDs that shall be disabled when the user
		 * clicks this checkbox.
		 *
		 * <p>To represent the checkbox itself, the developer can specify <code>self</code>.
		 * For example,
		 * <pre><code>
		 * checkbox.setId('ok');
		 * wgt.setAutodisable('self,cancel');
		 * </code></pre>
		 * is the same as
		 * <pre><code>
		 * checkbox.setId('ok');
		 * wgt.setAutodisable('ok,cancel');
		 * </code></pre>
		 * that will disable
		 * both the ok and cancel checkboxes when an user clicks it.
		 *
		 * <p>The checkbox being disabled will be enabled automatically
		 * once the client receives a response from the server or a fixed timeout.
		 * In other words, the server doesn't notice if a checkbox is disabled
		 * with this method.
		 *
		 * <p>However, if you prefer to enable them later manually, you can
		 * prefix with '+'. For example,
		 * <pre><code>
		 * checkbox.setId('ok');
		 * wgt.setAutodisable('+self,+cancel');
		 * </code></pre>
		 *
		 * <p>Then, you have to enable them manually such as
		 * <pre><code>if (something_happened){
		 *  ok.setDisabled(false);
		 *  cancel.setDisabled(false);
		 *</code></pre>
		 *
		 * <p>Default: null.
		 * @return String
		 */
		/** Sets whether to disable the checkbox after the user clicks it.
		 * @param String autodisable
		 */
		autodisable: null,
		/**
		 * Return whether checkbox is in indeterminate state.
		 * Default: false.
		 *
		 * @return boolean
		 * @since 8.6.0
		 */
		/**
		 * Set whether checkbox is in indeterminate state.
		 *
		 * @param boolean indeterminate whether checkbox is indeterminate
		 * @since 8.6.0
		 */
		indeterminate: function (v) {
			var n = this.$n('real');
			if (n) {
				jq(n).prop('indeterminate', v);
			}
		},
		mold: function () {
			this.rerender();
		}
	},

	//super//
	focus_: function (timeout) {
		zk(this.$n('real') || this.$n()).focus(timeout);
		return true;
	},
	contentAttrs_: function () {
		var html = '',
			v; // cannot use this._name for radio
		if (v = this.getName())
			html += ' name="' + v + '"';
		if (this._disabled)
			html += ' disabled="disabled"';
		if (this._checked)
			html += ' checked="checked"';
		if (v = this._tabindex)
			html += ' tabindex="' + v + '"';
		if (v = this.getValue())
			html += ' value="' + v + '"';
		return html;
	},
	bind_: function (desktop) {
		this.$supers(Checkbox, 'bind_', arguments);

		var n = this.$n('real'),
			mold = this.$n('mold'),
			indeterminate = this.getIndeterminate();

		// Bug 2383106
		if (n.checked != n.defaultChecked)
			n.checked = n.defaultChecked;
		if (indeterminate)
			n.indeterminate = true;

		this.domListen_(n, 'onFocus', 'doFocus_')
			.domListen_(n, 'onBlur', 'doBlur_')
			.domListen_(mold, 'onMouseDown', '_doMoldMouseDown');

		this._setTabIndexForMold();
	},
	unbind_: function () {
		var n = this.$n('real'),
			mold = this.$n('mold');

		this.domUnlisten_(mold, 'onMouseDown', '_doMoldMouseDown')
			.domUnlisten_(n, 'onFocus', 'doFocus_')
			.domUnlisten_(n, 'onBlur', 'doBlur_');

		this.$supers(Checkbox, 'unbind_', arguments);
	},
	_setTabIndexForMold: function () {
		var mold = this.$n('mold');
		if (mold)
			mold.tabIndex = this._canTabOnMold() ? 0 : -1;
	},
	_canTabOnMold: function () {
		return !this._isDefaultMold() && !this.isDisabled();
	},
	doSelect_: function (evt) {
		if (!_shallIgnore(evt))
			this.$supers('doSelect_', arguments);
	},
	doClick_: function (evt) {
		if (!_shallIgnore(evt)) {
			// F55-ZK-12: Checkbox automatically disable itself after clicked
			// use the autodisable handler of button directly
			zul.wgt.ADBS.autodisable(this);
			var real = this.$n('real'),
				checked = real.checked;
			if (checked != this._checked) { //changed
				this.setChecked(checked); //so Radio has a chance to override it
				this.setIndeterminate(false);
				this.fireOnCheck_(checked);
			}
			if (zk.webkit && !zk.mobile)
				zk(real).focus();

			// B65-ZK-1837: should stop propagation
			evt.stop({propagation: true});
			this.$supers('doClick_', arguments);

			// B85-ZK-3866: do extra click, if it's a radio
			if (this.$instanceof(zul.wgt.Radio)) {
				var rg = this.getRadiogroup();
				if (rg) {
					rg.doClick_(evt);
				}
			}
		}
	},
	_doMoldMouseDown: function (evt) {
		if (this.isDisabled())
			evt.stop();
	},
	fireOnCheck_: function (checked) {
		this.fire('onCheck', checked);
	},
	beforeSendAU_: function (wgt, evt) {
		if (evt.name != 'onClick') //don't stop event if onClick (otherwise, check won't work)
			this.$supers('beforeSendAU_', arguments);
	},
	getTextNode: function () {
		return this.$n('cnt');
	},
	shallIgnoreClick_: function (evt) {
		return this.isDisabled();
	},
	domClass_: function () {
		var cls = this.$supers('domClass_', arguments),
			mold = this.getMold();

		cls += ' ' + this.$s(mold);
		if (!this._isDefaultMold()) {
			cls += ' ' + this.$s(mold + (this.isChecked() ? '-on' : '-off'));
			if (this.isDisabled())
				cls += ' ' + this.$s(mold + '-disabled');
		}
		return cls;
	},
	_isDefaultMold: function () {
		return this.getMold() == 'default';
	},
	doKeyDown_: function (evt) {
		this.$supers('doKeyDown_', arguments);
		var spaceKeyCode = 32;
		if (evt.domTarget == this.$n('mold') && evt.keyCode == spaceKeyCode) {
			var checked = !this.isChecked();
			this.setChecked(checked);
			this.fireOnCheck_(checked);
		}
	}
});

})();