// File control

import $ from 'jquery';

import IndividualModel from '../../common/individual_model.js';

import Util from '../../common/util.js';

import Backend from '../../common/backend.js';

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
      const temp = $('<div></div>').append(image);
      System.import('cropper/cropper.min.js').then((module) => {
        const Cropper = module.default;
        System.import('cropper/cropper.min.css').then((module) => {
          const styleSheet = module.default;
          document.adoptedStyleSheets = [...document.adoptedStyleSheets, styleSheet];

          const cropper = new Cropper(image, {
            autoCrop: false,
            ready: function (event) {
              console.log('Crop ready');
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
    System.import('cropper/cropper.min.js').then((module) => {
      const Cropper = module.default;
      System.import('cropper/cropper.min.css').then((module) => {
        const styleSheet = module.default;
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
};

$.fn.veda_file = function ( options ) {
  const opts = $.extend( {}, $.fn.veda_file.defaults, options );
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

  if (!isSingle) {
    fileInput.attr('multiple', 'multiple');
  }
  if (accept) {
    fileInput.attr('accept', accept);
  }

  const progress = function (progressEvent) {
    if (progressEvent.lengthComputable) {
      try {
        const percentComplete = Math.round(progressEvent.loaded / progressEvent.total * 100);
        indicatorPercentage.text(percentComplete + '%').show();
      } catch (err) {
        console.log('Progress indicator error', error);
      }
    } else {
      indicatorSpinner.show();
    }
  };

  const createFileIndividual = function (file, name, parent) {
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
    fileIndividual['v-s:backwardProperty'] = [rel_uri];
    fileIndividual["v-s:canRead"] = [true];
    fileIndividual["v-s:canUpdate"] = [true];
    fileIndividual["v-s:canDelete"] = [true];
    return new Promise((resolve, reject) => {
      // If file is image && !thumbnail
      if ( file.name && (/^(?!thumbnail-).+\.(jpg|jpeg|gif|png|bmp|svg)$/i).test(file.name) ) {
        loadImage(file)
          .then((image) => {
            if (targetRatio) {
              const curRatio = image.height / image.width;
              console.log('curRatio: ', curRatio);
              if ( !((targetRatio - 0.1) < curRatio && curRatio < (targetRatio + 0.1)) ) {
                return cropImage(image, targetRatio, maxWidth);
              };
            };
            return image;
          }).then((image) => {
            if (image === false) {
              reject(Error('Cropper canceled'));
            } else {
              file = image;
              return resizeImage(image, 256).then((thumbnail) => {
                createFileIndividual(thumbnail, 'thumbnail-' + fileName, fileIndividual)
                  .then((thumbnailIndividual) => {
                    fileIndividual['v-s:thumbnail'] = [thumbnailIndividual];
                    resolve(fileIndividual);
                  });
              });
            };
          });
      } else {
        resolve(fileIndividual);
      }
    }).then(() => {
      return Backend.uploadFile({
        file: file,
        path: path,
        uri: uri,
        progress: progress,
      });
    }).then(() => {
      return fileIndividual.save();
    }).catch((error) => {
      console.log(error);
    });
  };

  fileInput.change((e) => {
    const self = e.delegateTarget;
    const fileIndividualPromises = [];
    for (let i = 0, file; (file = self.files && self.files[i]); i++) {
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
      })
      .catch((error) => {
        console.log(error);
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

$.fn.veda_file.defaults = {
  template: $('#file-control-template').html(),
};
