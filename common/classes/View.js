import {$, tr} from '../libs';

export default class View {

  static linkStateHandlers = {
    visible: (ctrl, value)=> View.classProperty(ctrl, 'hidden', !value),
    active: (ctrl, value)=> View.classProperty(ctrl, 'active', value),
    enable: (ctrl, value)=> View.classProperty(ctrl, 'disabled', !value)
  };

  static widgetStateHandlers = {
    visible: (ctrl, value)=> View.classProperty(ctrl, 'hidden', !value),
    active: (ctrl, value)=> View.classProperty(ctrl, 'active', value),
    enable: (ctrl, value)=> View.classProperty(ctrl, 'disabled', !value)
  };

  static inputStateHandlers = {
    visible: (ctrl, value)=> View.classProperty(ctrl, 'hidden', !value),
    value: (ctrl, value)=> ctrl[0].value = value,
    enable: (ctrl, value)=> View.attributeProperty(ctrl, 'disabled', !value)
  };

  static textStateHandlers = {
    visible: (ctrl, value)=> View.classProperty(ctrl, 'hidden', !value),
    value: (ctrl, value)=> ctrl.text(value)
  };

  static classProperty(ctrl, className, value) {
    if(value) {
      ctrl.addClass(className);
    }
    else {
      ctrl.removeClass(className);
    }
  }

  static attributeProperty(ctrl, attributeName, value) {
    if(value) {
      ctrl.attr(attributeName, value);
    }
    else {
      ctrl.removeAttr(attributeName);
    }
  }

  static callHandlers(handlers, id, e, data) {
    for(let handler of handlers) {
      if(handler[id]) {
        handler[id](e, data);
      }
      else if(handler.handleDefault) {
        handler.handleDefault(id, e, data);
      }
    }
  }

  static handleEvent(id, getHandlers, e, data) {
    View.callHandlers(getHandlers(id), id, e, data);
  }

  static handleLinkEvent(e) {
    e.preventDefault();
    if(!this.ctrl.hasClass('disabled')) {
      View.handleEvent(this.id, this.getHandlers, e);
    }
  }

  static handleInputEvent(e) {
    View.handleEvent(this.id, this.getHandlers, e, e.target.value);
  }

  static handleFormEvent(e) {
    e.preventDefault();
    View.handleEvent(this.id, this.getHandlers, e);
  }

  // virtual functions {
  getLinks() {
    return null;
  }

  getWidgets() {
    return null;
  }

  getInputs() {
    return null;
  }

  getTexts() {
    return null;
  }

  getTemplate() {
    return {};
  }

  getHandlers(id) {
    return this.handlers;
  }
  // }

  callLater(handlers, id, e, data, ms) {
    this.pendings[id] = {
      timestamp: new Date().getTime()
    };
    setTimeout(()=> {
      const timestamp = new Date().getTime(), pending = this.pendings[id];
      if(pending && timestamp-pending.timestamp>=ms) {
        View.callHandlers(handlers, id, e, data);
        delete this.pendings[id];
      }
    }, ms);
  }

  // loadFiles(urls, ready, failure) {
  //   let done = Promise.resolve();
  //   for(let url of urls) {
  //     done = done.then(()=> {
  //       return new Promise((resolve, reject)=> {
  //         $.get(url, (res)=> {
  //           ready(res, url);
  //           resolve();
  //         }).fail((res)=> {
  //           if(failure && failure(res, url)) {
  //             resolve();
  //           }
  //           else {
  //             reject(res);
  //           }
  //         });
  //       });
  //     });
  //   }
  //   return done;
  // }

  loadFiles(urls, files) {
    const tasks = [];
    for(let name of Object.keys(urls)) {
      files[name] = [];
      for(let url of urls[name]) {
        tasks.push(
          new Promise((resolve, reject)=> {
            $.get(url, (data)=> {
              files[name].push({url, data});
              resolve();
            }).fail((res)=> {
              reject(res);
            });
          })
        );
      }
    }
    return Promise.all(tasks);
  }

  urlResolver(baseUrl, url) {
    url = url.replace(/\\/g, '/');
    if(url.charAt(0)!=='/') {
      baseUrl = baseUrl.replace(/\\/g, '/');
      const p = baseUrl.lastIndexOf('/');
      url = (~p? baseUrl.substr(0, p+1): '')+url;

      const parts = url.split('/');
      url = [];
      for(let part of parts) {
        if(part==='.') {
        }
        else if(part==='..') {
          if(url.length && !(url.length===1 && url[0]==='')) {
            url.pop();
          }
        }
        else {
          url.push(part);
        }
      }
      url = url.join('/');
    }

    return url;
  }

  objToAttrsStr(o) {
    const res = [];
    for(let name of Object.keys(o)) {
      res.push([name, '="', o[name], '"'].join(''));
    }
    return res.join(' ');
  }

  checkIframeSize() {
    if(this.frame) {
      if(Math.abs(this.frame.width-this.parentContainer.width())>1 || Math.abs(this.frame.height-this.parentContainer.height())>1) {
        this.onResize();
      }
      setTimeout(this.checkIframeSize.bind(this), 250);
    }
  }

  onResize() {
    this.frame.width = this.parentContainer.width();
    this.frame.height = this.parentContainer.height();
  }

  translate(html) {
    return html.replace(/<\$tr>(.*)<\/\$tr>/gi, (s0,s1)=> tr(s1));
  }

  fireLinksOnLoadEvent() {
    if(this.templateObject && this.templateObject.linkLoaded) {
      let loaded = true;
      for(let jLink of this.jLinks) {
        const link = jLink[0];
        const img = new Image();
        img.onerror = ()=> this.templateObject.linkLoaded(link);
        img.src = link.href;
      }
    }
  }

  constructor(parentContainer, onLoad, template={}) {
    this.pendings = {};
    this.binds = {
      onResize: this.onResize.bind(this)
    };
    this.parentContainer = $(parentContainer);
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    this.parentContainer.html('<iframe style="border: 0;'+(this.isIOS? '': ' width: 100%; height: 100%')+'" scrolling="no"></iframe>');

    this.frame = this.parentContainer.find('iframe')[0];
    if(this.frame.contentWindow.stop) {
      this.frame.contentWindow.stop();
    }
    if(this.isIOS) {
      $(this.parentContainer[0].ownerDocument.defaultView).on('resize', this.binds.onResize);
      this.onResize();
      setTimeout(this.checkIframeSize.bind(this), 250);
    }

    this.container = $(this.frame.contentDocument.body);
    this.container.css('margin', '0');
    this.head = $(this.frame.contentDocument.head);
    this.onLoad = onLoad;
    this.handlers = [];

    const script = template.html? template.script: this.getTemplate().script;
    const urls = {
      styles: template.styles || this.getTemplate().styles,
      html: [template.html || this.getTemplate().html],
      script: script? [script]: []
    }, files = {}, links = template.links || this.getTemplate().links;

    this.loadFiles(urls, files).then(()=> {
      for(let style of files.styles) {
        let textCss = style.data, url = style.url;
        textCss = textCss.replace(/url\(['"](.*?)["']\)/g, (r, r1)=> {
          return ['url(', this.urlResolver(url, r1), ')'].join('');
        });
        $(`<style type="text/css">${textCss}</style>`).appendTo(this.head);
      }

      this.container.html(this.translate(files.html[0].data));

      this.jLinks = [];
      for(let link of links) {
        this.jLinks.push($(['<link ', this.objToAttrsStr(link), '>'].join('')).appendTo(this.head));
      }

      if(files.script[0]) {
        const init = eval(files.script[0].data);
        this.templateObject = init(this.container);
      }
      else {
        this.templateObject = {};
      }

      this.linkControls = {};
      for(let id of this.getLinks()) {
        this.linkControls[id] = this.container.find('.'+id);
        this.binds[id] = View.handleLinkEvent.bind({getHandlers: this.getHandlers.bind(this), id, ctrl: this.linkControls[id]});
        this.linkControls[id].on('click', this.binds[id]);
      }

      this.widgetControls = {};
      for(let id of this.getWidgets()) {
        this.widgetControls[id] = this.container.find('.'+id);
      }

      this.inputControls = {};
      for(let id of this.getInputs()) {
        this.inputControls[id] = this.container.find('.'+id);
        this.binds[id] = View.handleInputEvent.bind({getHandlers: this.getHandlers.bind(this), id, ctrl: this.inputControls[id]});
        this.inputControls[id].on('keyup', this.binds[id]);
      }

      this.formControls = {};
      for(let id of this.getForms()) {
        this.formControls[id] = this.container.find('.'+id);
        this.binds[id] = View.handleFormEvent.bind({getHandlers: this.getHandlers.bind(this), id, ctrl: this.formControls[id]});
        this.formControls[id].on('submit', this.binds[id]);
      }

      this.textControls = {};
      for(let id of this.getTexts()) {
        this.textControls[id] = this.container.find('.'+id);
      }

      this.stateSetters = [
        {
          map: this.linkControls,
          setter: this.setLinkControlState.bind(this)
        },
        {
          map: this.widgetControls,
          setter: this.setWidgetControlState.bind(this)
        },
        {
          map: this.inputControls,
          setter: this.setInputControlState.bind(this)
        },
        {
          map: this.textControls,
          setter: this.setTextControlState.bind(this)
        }
      ];

      this.initView();

      if(this.onLoad) {
        this.onLoad();
      }

      this.fireLinksOnLoadEvent();
    }).
    catch((res)=> console.error(res));
  }

  dispose() {
    delete this.textControls;
    for(let id of this.getLinks()) {
      this.linkControls[id].off('click', this.binds[id]);
    }
    delete this.linkControls;
    delete this.widgetControls;
    for(let id of this.getInputs()) {
      this.inputControls[id].off('keyup', this.binds[id]);
    }
    delete this.inputControls;
    for(let id of this.getForms()) {
      this.formControls[id].off('submit', this.binds[id]);
    }
    delete this.formControls;

    !this.templateObject.dispose || this.templateObject.dispose();
    delete this.templateObject;

    if(this.isIOS) {
      $(this.parentContainer[0].ownerDocument.defaultView).off('resize', this.binds.onResize);
    }
    this.parentContainer.html('');
    delete this.frame;
  }

  getContainer() {
    return this.container[0];
  }

  getParentContainer() {
    return this.parentContainer[0];
  }

  addHandler(handler) {
    this.handlers.push(handler);
  }

  initView() {

  }

  static setControlState(ctrl, defaults, state, stateHandlers) {
    if(ctrl) {
      const st = {
        ...defaults,
        ...state
      };
      for(let name in st) {
        if(st.hasOwnProperty(name) && stateHandlers[name]) {
          stateHandlers[name](ctrl, st[name]);
        }
      }
    }
  }

  setLinkControlState(id, state) {
    View.setControlState(
      this.linkControls[id],
      {
        visible: true,
        active: false,
        enable: true
      },
      state,
      View.linkStateHandlers
    );
  }

  setWidgetControlState(id, state) {
    View.setControlState(
      this.widgetControls[id],
      {
        visible: true,
        active: false,
        enable: true
      },
      state,
      View.widgetStateHandlers
    );
  }

  setInputControlState(id, state) {
    View.setControlState(
      this.inputControls[id],
      {
        visible: true,
        enable: true,
        value: ''
      },
      state,
      View.inputStateHandlers
    );
  }

  setTextControlState(id, state) {
    View.setControlState(
      this.textControls[id],
      {
        visible: true,
        value: ''
      },
      state,
      View.textStateHandlers
    );
  }

  onItemStateChanged() {

  }

  setState(id, state) {
    for(let item of this.stateSetters) {
      if(item.map[id]) {
        item.setter(id, state);
        this.onItemStateChanged(id, state);
        break;
      }
    }
  }

}
