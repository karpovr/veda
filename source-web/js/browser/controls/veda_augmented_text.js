import $ from 'jquery';
import veda_literal from './veda_literal.js';
import notify from '../../browser/notify.js';
import {decorator} from '../../browser/dom_helpers.js';

// Function to recognize audio file
async function recognizeAudioFile (file) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('/recognize_audio', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || response.status);
    }

    const recognizedText = await response.text();
    return recognizedText;
  } catch (error) {
    console.error('Audio recognition error:', error);
    throw error;
  }
}

// Function to augment text
async function augmentText (text, type, property) {
  try {
    const response = await fetch('/augment_text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({text, type, property}),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || response.status);
    }

    const augmentedText = await response.text();
    return augmentedText;
  } catch (error) {
    console.error('Text augmentation error:', error);
    throw error;
  }
}

// Function to show spinner on the button
function showSpinner (button) {
  button.find('i').addClass('fa-spinner fa-spin').removeClass('fa-microphone fa-magic fa-stop');
  button.prop('disabled', true);
}

// Function to hide spinner on the button
function hideSpinner (button, iconClass) {
  button.find('i').removeClass('fa-spinner fa-spin').addClass(iconClass);
  button.prop('disabled', false);
}

// Function to handle errors uniformly
async function handleError (error, button, errorIconClass) {
  hideSpinner(button, errorIconClass);
  notify('danger', 'Error occurred: ' + error);
}

// Decorate functions with pre and post conditions including error handling
const decoratedRecognizeAudioFile = decorator(
  recognizeAudioFile,
  function pre () {
    showSpinner(this);
  },
  function post () {
    hideSpinner(this, 'fa-microphone');
  },
  function err (error) {
    handleError(error, this, 'fa-microphone');
  },
);

const decoratedAugmentText = decorator(
  augmentText,
  function pre () {
    showSpinner(this);
  },
  function post () {
    hideSpinner(this, 'fa-magic');
  },
  function err (error) {
    handleError(error, this, 'fa-magic');
  },
);

$.fn.veda_augmentedText = function (options) {
  const opts = {...defaults, ...options};
  const control = veda_literal.call(this, opts);

  const controlsContainer = $(`
    <div class="input-group">
      <textarea rows="1" class="form-control"></textarea>
      <div class="input-group-addon btn btn-default">
        <i class="fa fa-microphone"></i>
      </div>
      <div class="input-group-addon btn btn-default" style="margin-left: 5px;">
        <i class="fa fa-magic"></i>
      </div>
    </div>
  `);

  const micButton = controlsContainer.find('.fa-microphone').closest('.btn');
  const augmentButton = controlsContainer.find('.fa-magic').closest('.btn');

  // Array to store audio chunks
  let mediaRecorder;
  const audioChunks = [];

  // Request access to microphone
  async function requestMicrophoneAccess () {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      return stream;
    } catch (error) {
      notify('danger', 'Microphone access denied: ' + error.message);
      throw error;
    }
  }

  // Handler for the microphone button
  micButton.click(async function () {
    if (micButton.find('i').hasClass('fa-microphone')) {
      try {
        micButton.prop('disabled', true);
        const stream = await requestMicrophoneAccess();
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorder.start();

        micButton.find('i').removeClass('fa-microphone').addClass('fa-stop');
        micButton.prop('disabled', false);

        micButton.one('click', async function () {
          mediaRecorder.stop();
          micButton.prop('disabled', true);

          mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, {type: 'audio/wav'});
            try {
              const recognizedText = (await decoratedRecognizeAudioFile.call(micButton, audioBlob)).trim();
              const currentValue = opts.individual.get(opts.property_uri).join('\n');
              opts.individual.set(opts.property_uri, currentValue ? currentValue + ' ' + recognizedText : recognizedText);

              // Clear audio chunks array
              audioChunks.splice(0, audioChunks.length);
            } catch (error) {
              console.error('Audio recognition error:', error);
            }
          };
        });
      } catch (error) {
        micButton.prop('disabled', false);
        console.error('Audio recording error:', error);
      }
    }
  });

  // Handler for the text augmentation button
  augmentButton.click(async function () {
    const currentText = opts.individual.get(opts.property_uri).join(' ');
    try {
      const augmentedText = await decoratedAugmentText.call(augmentButton, currentText, opts.individual['rdf:type'][0].id, opts.property_uri);
      opts.individual.set(opts.property_uri, augmentedText);
    } catch (error) {
      console.error('Text augmentation error:', error);
    }
  });

  controlsContainer.find('textarea').replaceWith(control);

  this.append(controlsContainer);
  return this;
};

const defaults = {
  template: '<textarea class="form-control" rows="1"></textarea>',
  parser: function (input) {
    return input ? String(input) : null;
  },
  isSingle: true,
};
