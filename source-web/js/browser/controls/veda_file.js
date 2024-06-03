// File control

import $ from 'jquery';

import IndividualModel from '../../common/individual_model.js';

import Util from '../../common/util.js';

import notify from '../../browser/notify.js';

function uploadFile ({file, path, uri, progress}, retry) {
  retry = typeof retry === 'number' ? retry : 2;
  return new Promise((resolve, reject) => {
    const done = () => {
      if (xhr.status === 200) {
        resolve();
      } else {
        reject(Error(xhr.response || xhr.responseText));
      }
    };
    const fail = () => {
      reject(Error('File upload failed'));
    };
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    xhr.open('POST', '/files', true);
    xhr.timeout = 10 * 60 * 1000;
    xhr.upload.onprogress = progress;
    xhr.onload = done;
    xhr.onerror = xhr.onabort = xhr.ontimeout = fail;
    fd.append('path', path);
    fd.append('uri', uri);
    if (file instanceof File) {
      fd.append('file', file);
    } else if (file instanceof Image) {
      fd.append('content', file.src);
    }
    xhr.send(fd);
  }).catch((error) => {
    console.log('File upload error:', error);
    if (retry > 0) {
      return uploadFile({file, path, uri, progress}, --retry);
    }
    throw error;
  });
}

/**
 * Load image to browser
 * @param {File} imageFile - value from file input
 * @return {Promise}
 */
function loadImage (imageFile) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (e) {
      const image = new Image();
      image.onload = function () {
        resolve(image);
      };
      image.onerror = function () {
        reject( new Error('Image load error') );
      };
      image.src = e.target.result;
    };
    reader.onerror = function () {
      reject( new Error('File reader error') );
    };
    reader.readAsDataURL(imageFile);
  });
}

/**
 * Resize image to max width
 * @param {Image} image
 * @param {number} maxWidth - width in pixels
 * @return {Promise}
 */
function resizeImage (image, maxWidth) {
  return new Promise((resolve, reject) => {
    if (image.width <= maxWidth) {
      resolve(image);
    } else {
      const temp = $('<div></div>');
      temp.append(image);
      import('cropper/cropper.min.js').then((cropperModule) => {
        const Cropper = cropperModule.default;
        import('cropper/cropper.min.css').then((cropperStyle) => {
          const styleSheet = cropperStyle.default;
          document.adoptedStyleSheets = [...document.adoptedStyleSheets, styleSheet];

          const cropper = new Cropper(image, {
            autoCrop: false,
            ready: function (event) {
              const ratio = image.height / image.width;
              const resized = new Image();
              resized.src = cropper.getCroppedCanvas({
                maxWidth: maxWidth,
                maxHeight: Math.floor(maxWidth * ratio),
              }).toDataURL('image/jpeg');
              resolve(resized);
              cropper.destroy();
            },
          });
        });
      });
    }
  });
}

/**
 * Crop image
 * @param {Image} imageForCrop
 * @param {number} ratio
 * @param {number} maxWidth
 * @return {Promise}
 */
function cropImage (imageForCrop, ratio, maxWidth) {
  const modal = $( $('#confirm-modal-template').html() );
  modal.modal();
  $('body').append(modal);
  const container = $('.modal-body', modal);
  imageForCrop.style.cssText = 'display:block; width:100%';
  const temp = $('<div></div>').append(imageForCrop);
  container.append(temp);

  return new Promise((resolve, reject) => {
    import('cropper/cropper.min.js').then((cropperModule) => {
      const Cropper = cropperModule.default;
      import('cropper/cropper.min.css').then((cropperStyle) => {
        const styleSheet = cropperStyle.default;
        document.adoptedStyleSheets = [...document.adoptedStyleSheets, styleSheet];

        // in templates ratio=h/w, in crop ratio=w/h
        const cropper = new Cropper(imageForCrop, {
          aspectRatio: 1 / ratio,
          movable: false,
          rotable: false,
          scalable: false,
          ready: function (event) {
            console.log('Crop ready');
          },
        });

        $('.modal-footer > .ok', modal).click(() => {
          const img = new Image();
          img.src = cropper.getCroppedCanvas({
            maxWidth: maxWidth,
            maxHeight: Math.floor(maxWidth*ratio),
          }).toDataURL('image/jpeg');
          resolve(img);
          cropper.destroy();
        });
        $('.modal-footer > .cancel', modal).click(() => {
          resolve(false);
        });
        modal.on('hidden.bs.modal', function () {
          modal.remove();
          resolve(false);
          cropper.destroy();
        });
      });
    });
  });
}

$.fn.veda_file = function ( options ) {
  const opts = {...defaults, ...options};
  const control = $(opts.template);
  const fileInput = control.find('input[type="file"]');
  const indicatorPercentage = $('.indicator-percentage', control);
  const indicatorSpinner = $('.indicator-spinner', control);
  const spec = opts.spec;
  const individual = opts.individual;
  const rel_uri = opts.property_uri;
  const rangeRestriction = spec && spec.hasValue('v-ui:rangeRestriction') ? spec['v-ui:rangeRestriction'][0] : undefined;
  const range = rangeRestriction ? [rangeRestriction] : new IndividualModel(rel_uri)['rdfs:range'];
  const isSingle = spec && spec.hasValue('v-ui:maxCardinality') ? spec['v-ui:maxCardinality'][0] === 1 : true;
  const accept = this.attr('accept');
  const maxWidth = this.attr('data-max-width') || 2048;
  const targetRatio = this.attr('data-ratio');
  const withUUID = this.attr('data-with-UUID');
  if (!isSingle) {
    fileInput.attr('multiple', 'multiple');
  }
  if (accept) {
    fileInput.attr('accept', accept);
  }
  const clipboardButton = control.find('.paste-btn');
  const clipboardGroup = control.find('div.input-group');
  const clipboardInput = clipboardGroup.find('input[type=\'text\']');
  const clipboardClose = clipboardGroup.find('span');
  clipboardButton.tooltip({
    container: control,
    placement: 'top',
    trigger: 'hover',
    title: 'Приложить файл из буфера обмена',
  });
  clipboardInput.tooltip({
    container: control,
    placement: 'top',
    trigger: 'hover',
    title: 'Выполните вставку',
  });

  clipboardButton.click(function () {
    clipboardButton.hide();
    clipboardGroup.show();
    clipboardInput.focus();
  });

  clipboardClose.click(function () {
    clipboardButton.show();
    clipboardGroup.hide();
  });

  function pasteListener (event) {
    if (event.clipboardData != undefined && event.clipboardData.files.length > 0) {
      fileInput[0].files = event.clipboardData.files;
      fileInput.change();
    }
    event.preventDefault();
  }
  clipboardInput[0].addEventListener('paste', pasteListener);

  const progress = function (progressEvent) {
    if (progressEvent.lengthComputable) {
      try {
        const percentComplete = Math.round(progressEvent.loaded / progressEvent.total * 100);
        indicatorPercentage.text(percentComplete + '%').show();
      } catch (error) {
        console.error('Progress indicator failed');
      }
    } else {
      indicatorSpinner.show();
    }
  };

  const createFileIndividual = function (file, name, parent, isThumbnail) {
    const fileName = file.name || name;
    const uri = Util.guid();
    const path = '/' + new Date().toISOString().substring(0, 10).split('-').join('/');
    const fileIndividual = new IndividualModel();
    fileIndividual['rdf:type'] = range;
    fileIndividual['v-s:fileName'] = [fileName];
    fileIndividual['rdfs:label'] = [fileName];
    fileIndividual['v-s:fileSize'] = [file.size];
    fileIndividual['v-s:fileUri'] = [uri];
    fileIndividual['v-s:filePath'] = [path];
    fileIndividual['v-s:parent'] = [parent];
    fileIndividual['v-s:backwardTarget'] = [parent];
    fileIndividual['v-s:canRead'] = [true];
    fileIndividual['v-s:canUpdate'] = [true];
    fileIndividual['v-s:canDelete'] = [true];
    fileIndividual.file = file;
    if (isThumbnail) {
      fileIndividual['v-s:backwardProperty'] = ['v-s:thumbnail'];
    } else {
      fileIndividual['v-s:backwardProperty'] = [rel_uri];
      if (withUUID == 'true') {
        fileIndividual['v-s:uid'] = [crypto.randomUUID()];
        console.log(fileIndividual['v-s:uid'][0]);
      }
    }
    return new Promise((resolve, reject) => {
      // If file is image && !thumbnail
      if ( file.name && (/^(?!thumbnail-).+\.(jpg|jpeg|gif|png|bmp|svg)$/i).test(file.name) ) {
        loadImage(file)
          .then((image) => {
            if (targetRatio) {
              const curRatio = image.height / image.width;
              if ( !((targetRatio - 0.1) < curRatio && curRatio < (targetRatio + 0.1)) ) {
                return cropImage(image, targetRatio, maxWidth);
              }
            }
            return image;
          }).then((image) => {
            if (image === false) {
              reject(Error('Cropper canceled'));
            } else {
              file = image;
              return resizeImage(image, 256).then((thumbnail) => {
                createFileIndividual(thumbnail, 'thumbnail-' + fileName, fileIndividual, true)
                  .then((thumbnailIndividual) => {
                    fileIndividual['v-s:thumbnail'] = [thumbnailIndividual];
                    resolve(fileIndividual);
                  });
              });
            }
          });
      } else {
        resolve(fileIndividual);
      }
    }).then(() => {
      return uploadFile({file, path, uri, progress});
    }).then(() => {
      return isThumbnail ? fileIndividual.save() : fileIndividual;
    }).catch((error) => {
      notify('danger', error);
    });
  };

  fileInput.change((e) => {
    const self = e.delegateTarget;
    const fileIndividualPromises = [];
    for (let i = 0, file; i < self.files.length; i++) {
      file = self.files[i];
      const fileIndividualPromise = createFileIndividual(file, undefined, individual);
      fileIndividualPromises.push(fileIndividualPromise);
    }
    if (!fileIndividualPromises.length) {
      return;
    }
    control.addClass('disabled');
    fileInput.attr('disabled', 'disabled');
    Promise.all(fileIndividualPromises)
      .then((fileIndividuals) => {
        control.removeClass('disabled');
        fileInput.removeAttr('disabled');
        self.value = '';
        indicatorSpinner.empty().hide();
        indicatorPercentage.empty().hide();
        if (isSingle) {
          individual.set(rel_uri, fileIndividuals);
        } else {
          individual.addValue(rel_uri, fileIndividuals);
        }
        fileInput[0].dispatchEvent(new CustomEvent('fileAttached'));
      })
      .catch((error) => {
        console.error('Files individuals save failed');
      })
      .then(() => {
        control.removeClass('disabled');
        fileInput.removeAttr('disabled');
      });
  });

  this.on('view edit search', function (e) {
    e.stopPropagation();
  });
  this.append(control);
  return this;
};

const defaults = {
  template: `
<div style="display:flex">
  <label class="btn btn-default">
    Browse...
    <strong class="indicator-percentage"></strong>
    <span class="indicator-spinner fa fa-spinner fa-pulse fa-lg fa-fw text-info" style="display:none"></span>
    <input type="file" style="display:none"/>
  </label>
  <label style="margin-left:5px;" class="paste-btn btn btn-default">
    <span class="glyphicon glyphicon-paste"></span>
  </label>
  <div class="input-group" style="margin-left:5px; display:none">
    <input type="text" class="form-control"/>
    <span class="input-group-btn">
      <button class="btn btn-default">&#10005;</button>
    </span>
  </div>
</div>
  `,
};
