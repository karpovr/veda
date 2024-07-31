import $ from 'jquery';
import veda_literal from './veda_literal.js';
import notify from '../../browser/notify.js';

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
      throw new Error((await response.text()) || response.status);
    }

    const recognizedText = await response.text();
    return recognizedText;
  } catch (error) {
    console.error('Ошибка распознавания аудио:', error);
    throw error;
  }
}

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
      throw new Error((await response.text()) || response.status);
    }

    const augmentedText = await response.text();
    return augmentedText;
  } catch (error) {
    console.error('Ошибка улучшения текста:', error);
    throw error;
  }
}

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

  let mediaRecorder;
  let audioChunks = [];

  async function requestMicrophoneAccess () {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      return stream;
    } catch (error) {
      notify('danger', 'Доступ к микрофону запрещен: ' + error.message);
      throw error;
    }
  }

  micButton.click(async () => {
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

        micButton.one('click', () => {
          mediaRecorder.stop();
        });

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, {type: 'audio/wav'});
          micButton.find('i').removeClass('fa-stop').addClass('fa-spinner fa-spin');
          try {
            const recognizedText = await recognizeAudioFile(audioBlob);
            const currentValue = opts.individual.get(opts.property_uri).join(' ').trim();
            opts.individual.set(opts.property_uri, currentValue ? currentValue + ' ' + recognizedText : recognizedText);
          } catch (error) {
            notify('danger', 'Ошибка распознавания аудио: ' + error);
          }
          micButton.find('i').removeClass('fa-spinner fa-spin').addClass('fa-microphone');
          audioChunks = [];
        };
      } catch (error) {
        micButton.prop('disabled', false);
        console.error('Ошибка записи аудио:', error);
      }
    }
  });

  augmentButton.click(async () => {
    augmentButton.find('i').addClass('fa-spinner fa-spin');
    try {
      const currentText = opts.individual.get(opts.property_uri).join(' ').trim();
      const augmentedText = await augmentText(currentText, opts.individual['rdf:type'][0].id, opts.property_uri);
      opts.individual.set(opts.property_uri, augmentedText);
    } catch (error) {
      notify('danger', 'Ошибка улучшения текста: ' + error);
    }
    augmentButton.find('i').removeClass('fa-spinner fa-spin');
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
