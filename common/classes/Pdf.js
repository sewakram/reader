import {PDFJS} from '../libs';
import Utils from './Utils';

PDFJS.workerSrc = (window.PDFJS_LOCALE? PDFJS_LOCALE: GLOBAL_PATHS).pdfJsWorker;
PDFJS.cMapUrl = (window.PDFJS_LOCALE? PDFJS_LOCALE: GLOBAL_PATHS).pdfJsCMapUrl;
PDFJS.cMapPacked = true;
PDFJS.disableAutoFetch = true;
PDFJS.disableStream = true;
PDFJS.imageResourcesPath = 'images/pdfjs/';
PDFJS.externalLinkTarget = PDFJS.LinkTarget.BLANK;

export default class Pdf {

  constructor(src, loadingProgress) {
    this.src = Utils.normalizeUrl(src);
    this.handlerQueue = [];
    this.progresData = {loaded: -1, total: 1};
    this.loadingProgress = loadingProgress;

    this.task = PDFJS.getDocument({
      url: this.src,
      rangeChunkSize: 512*1024
    });
    this.task.onProgress = (data)=> {
      if(this.loadingProgress) {
        let cur = Math.floor(100*data.loaded/data.total),
              old = Math.floor(100*this.progresData.loaded/this.progresData.total);
        if(cur!==old) {
          cur = isNaN(cur)? 0: cur;
          cur = cur>100? 100: cur;
          Promise.resolve().then(()=> {
            this.loadingProgress(cur);
          });
        }
      }
      this.progresData = data;
    };
    this.task.then((handler)=> {
      if(handler.numPages>1) {
        Promise.all([handler.getPage(1), handler.getPage(2)]).
        then((pages)=> {
          this.init(handler, pages);
        });
      }
      else {
        this.init(handler);
      }
    }).
    catch((e)=> console.error(e));
  }

  init(handler, pages) {
    this.handler = handler;
    this.doubledPages = pages? (Math.abs(2*Pdf.getPageSize(pages[0]).width-Pdf.getPageSize(pages[1]).width)/Pdf.getPageSize(pages[0]).width<0.01): false;
    let done = Promise.resolve(handler);
    for(let clb of this.handlerQueue.reverse()) {
      done = done.then((handler)=> {
        clb(handler);
        return handler;
      });
    }
  }

  getPageType(n) {
    return !this.doubledPages || n===0 || n===this.getPagesNum()-1? 'full': (n&1? 'left': 'right');
  }

  getPage(n) {
    return this.handler.getPage(this.doubledPages? Math.ceil(n/2)+1: n+1);
  }

  dispose() {
    this.handlerQueue.splice(0, this.handlerQueue.length);
    delete this.handler;
  }

  setLoadingProgressClb(clb) {
    this.loadingProgress = clb;
  }

  getPagesNum() {
    return this.handler? (this.doubledPages? 2*(this.handler.numPages-1): this.handler.numPages): undefined;
  }

  static getPageSize(page) {
    return {
      width: page.view[2]-page.view[0],
      height: page.view[3]-page.view[1]
    };
  }

//   if(pages>1) {
//   handler.getPage(2).
//   then((page)=> {
//     const size1 = Pdf.getPageSize(page);
//     this.props.doubledPages = 2*size0.width===size1.width;
//     this.ready();
//   }).
//   catch(()=> this.ready());
// }
// else {

  getHandler(clb) {
    if(this.handler) {
      clb(this.handler);
    }
    else {
      this.handlerQueue.push(clb);
    }
  }

}
