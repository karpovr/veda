import $ from 'jquery';
import veda_literal from './veda_literal.js';
import notify from '../../browser/notify.js';
import {decorator} from '../../browser/dom_helpers.js';

// Асинхронная функция для распознавания аудиофайла
async function recognizeAudioFile (file, fn) {
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

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let resultText = '';

    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      const decoded = decoder.decode(value, {stream: true});
      fn(decoded);
      resultText += decoded;
    }

    return resultText;
  } catch (error) {
    console.error('Ошибка распознавания аудио:', error);
    throw error;
  }
}

// Асинхронная функция для улучшения текста
async function augmentText (text, type, property, fn) {
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

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let resultText = '';

    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      const decoded = decoder.decode(value, {stream: true});
      fn(decoded);
      resultText += decoded;
    }

    return resultText;
  } catch (error) {
    console.error('Ошибка улучшения текста:', error);
    throw error;
  }
}

// Показ спиннера на кнопке
function showSpinner (button) {
  button.find('i').addClass('fa-spinner fa-spin').removeClass('fa-microphone fa-magic fa-stop');
  button.prop('disabled', true);
}

// Скрытие спиннера на кнопке
function hideSpinner (button, iconClass) {
  button.find('i').removeClass('fa-spinner fa-spin').addClass(iconClass);
  button.prop('disabled', false);
}

// Обработка ошибок
async function handleError (error, button, errorIconClass) {
  hideSpinner(button, errorIconClass);
  notify('danger', 'Произошла ошибка: ' + error);
}

// Декораторы для функций
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

// Основная функция плагина для jQuery
$.fn.veda_augmentedText = function (options) {
  const opts = {...defaults, ...options};
  const control = veda_literal.call(this, opts);

  // Создание контейнера для UI
  const controlsContainer = $(`
    <div style="position:relative">
      <textarea class="form-control"></textarea>
      <div style="position:absolute;right:10px;bottom:0px;display:flex;align-items:center;">
        <div class="cancel-button btn btn-link hidden" style="padding:6px">
          <i class="fa fa-times"></i>
        </div>
        <canvas class="audio-visualization hidden" width="16" height="24" style="margin: 0 6px 0 0;"></canvas>
        <span class="recording-timer hidden">0.0</span>
        <div class="approve-button btn btn-link hidden" style="padding:6px">
          <i class="fa fa-check"></i>
        </div>
        <div class="btn btn-link mic-button" style="padding:6px">
          <i class="fa fa-microphone"></i>
        </div>
        <div class="btn btn-link" style="padding:6px">
          <i class="fa fa-magic"></i>
        </div>
      </div>
    </div>
  `);

  const micButton = controlsContainer.find('.mic-button');
  const augmentButton = controlsContainer.find('.fa-magic').closest('.btn');
  const canvas = controlsContainer.find('.audio-visualization')[0];
  const canvasCtx = canvas.getContext('2d');
  const cancelButton = controlsContainer.find('.cancel-button');
  const approveButton = controlsContainer.find('.approve-button');
  const recordingTimer = controlsContainer.find('.recording-timer');

  let mediaRecorder;
  let audioChunks = [];
  let audioContext;
  let analyser;
  let startTime;
  let timerInterval;

  // Запрос доступа к микрофону
  async function requestMicrophoneAccess () {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      return stream;
    } catch (error) {
      notify('danger', 'Доступ к микрофону запрещен: ' + error.message);
      throw error;
    }
  }

  // Визуализация интенсивности звука
  function startIntensityVisualization (stream) {
    // Создание аудиоконтекста
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    source.connect(analyser);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const audioDataArray = new Uint8Array(bufferLength);
    canvas.style.display = 'block';

    const sampleRate = audioContext.sampleRate;
    const minFrequency = 1000; // Минимальная частота голоса в Гц
    const maxFrequency = 3000; // Максимальная частота голоса в Гц
    const minBin = Math.floor(minFrequency / (sampleRate / analyser.fftSize));
    const maxBin = Math.ceil(maxFrequency / (sampleRate / analyser.fftSize));
    const numBars = 4;

    // Вычисляем ширину столбиков и расстояния между ними
    const barWidth = canvas.width / (numBars + (numBars - 1) * 0.62);
    const barSpacing = barWidth * 0.62;
    const halfHeight = canvas.height / 2;

    async function draw () {
      if (!analyser) return;

      analyser.getByteFrequencyData(audioDataArray);

      // Очистка канваса
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

      // Цвет фона
      canvasCtx.fillStyle = 'transparent';
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      // Рисуем столбики
      for (let i = 0; i < numBars; i++) {
        const startBin = Math.floor(minBin + i * ((maxBin - minBin) / numBars));
        const endBin = Math.ceil(minBin + (i + 1) * ((maxBin - minBin) / numBars));
        let sum = 0;

        // Рассчитываем среднюю амплитуду для текущего столбика
        for (let j = startBin; j < endBin; j++) {
          sum += audioDataArray[j];
        }
        const average = sum / (endBin - startBin);
        const barHeight = (average / 256) * halfHeight;
        const x = i * (barWidth + barSpacing);

        canvasCtx.fillStyle = `rgba(51, 122, 183, ${2 * barHeight / halfHeight})`;
        // Рисуем столбик вверх от середины
        canvasCtx.fillRect(x, halfHeight - barHeight, barWidth, barHeight);
        // Рисуем столбик вниз от середины
        canvasCtx.fillRect(x, halfHeight, barWidth, barHeight);
      }

      requestAnimationFrame(draw);
    }

    draw();
  }

  // Остановка визуализации звука
  function stopIntensityVisualization () {
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    if (analyser) {
      analyser.disconnect();
      analyser = null;
    }
  }

  // Обработчик событий для обновления таймера записи
  function startRecordingTimer () {
    startTime = Date.now();
    timerInterval = setInterval(() => {
      const elapsedTime = (Date.now() - startTime) / 1000;
      recordingTimer.text(elapsedTime.toFixed(1));
    }, 100);
  }

  function stopRecordingTimer () {
    clearInterval(timerInterval);
    recordingTimer.text('0.0');
  }

  // Функция окончания записи
  function stopRecording () {
    return new Promise((resolve) => {
      mediaRecorder.onstop = resolve;
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());
    });
  }

  micButton.click(async function () {
    if (micButton.find('i').hasClass('fa-microphone')) {
      try {
        micButton.prop('disabled', true);
        augmentButton.addClass('hidden');
        audioChunks = [];
        const stream = await requestMicrophoneAccess();
        mediaRecorder = new MediaRecorder(stream);

        startIntensityVisualization(stream);
        startRecordingTimer();

        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        mediaRecorder.start();

        micButton.addClass('hidden');
        approveButton.removeClass('hidden');
        cancelButton.removeClass('hidden');
        recordingTimer.removeClass('hidden');
        $(canvas).removeClass('hidden');

        micButton.prop('disabled', false);
      } catch (error) {
        // обратная смена свойств кнопки и отображение элементов управления
        augmentButton.removeClass('hidden');
        micButton.prop('disabled', false);
        console.error('Ошибка записи аудио:', error);
      }
    }
  });

  // Обработчик для кнопки "одобрения"
  approveButton.off('click').on('click', async function () {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      await stopRecording(); // Дождаться окончания записи
    }

    stopIntensityVisualization();
    stopRecordingTimer();

    // Очищаем элементы звуковой записи
    approveButton.addClass('hidden');
    cancelButton.addClass('hidden');
    recordingTimer.addClass('hidden');
    $(canvas).addClass('hidden');

    // Отображаем спиннер
    micButton.find('i').removeClass('fa-microphone').addClass('fa-spinner fa-spin');
    micButton.removeClass('hidden');

    try {
      await decoratedRecognizeAudioFile.call(micButton, new Blob(audioChunks, {type: 'audio/wav'}), (textChunk) => {
        const trimmed = textChunk.trim();
        const currentValue = opts.individual.get(opts.property_uri)[0];
        let value;
        if (!currentValue) {
          value = trimmed;
        } else if (currentValue.endsWith('\n')) {
          value = currentValue + trimmed;
        } else {
          value = currentValue + ' ' + trimmed;
        }
        opts.individual.set(opts.property_uri, value);
      });
    } catch (error) {
      console.error('Ошибка распознавания аудио:', error);
    } finally {
      audioChunks = [];
      micButton.find('i').removeClass('fa-spinner fa-spin').addClass('fa-microphone');
      micButton.prop('disabled', false);
      augmentButton.removeClass('hidden');
    }
  });

  // Обработчик для кнопки отмены
  cancelButton.off('click').on('click', async function () {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      await stopRecording(); // Дождаться окончания записи
    }

    stopIntensityVisualization();
    stopRecordingTimer();

    // Очистка массива аудио чанков
    audioChunks = [];

    // Сброс состояния кнопок
    micButton.find('i').removeClass('fa-stop').addClass('fa-microphone');
    micButton.prop('disabled', false);

    micButton.removeClass('hidden');
    augmentButton.removeClass('hidden'); // Показать кнопку аугментации
    approveButton.addClass('hidden');
    cancelButton.addClass('hidden');
    recordingTimer.addClass('hidden');
    $(canvas).addClass('hidden');
  });

  // Обработчик для кнопки улучшения текста
  augmentButton.click(async function () {
    micButton.addClass('hidden'); // Скрыть кнопку микрофона перед отправкой запроса

    const currentText = opts.individual.get(opts.property_uri).join(' ');
    try {
      await decoratedAugmentText.call(augmentButton, currentText, opts.individual['rdf:type'][0].id, opts.property_uri, (textChunk) => {
        const currentValue = opts.individual.get(opts.property_uri)[0] ?? '';
        opts.individual.set(opts.property_uri, currentValue + textChunk);
      });
    } catch (error) {
      console.error('Ошибка улучшения текста:', error);
    } finally {
      micButton.removeClass('hidden'); // Показать кнопку микрофона после завершения запроса
    }
  });

  controlsContainer.find('textarea').replaceWith(control);

  control.on('input change', function () {
    this.style.height = 'auto';
    if (this.scrollHeight > 200) {
      this.style.height = '200px';
      this.style.overflowY = 'scroll';
    } else {
      this.style.height = `${this.scrollHeight}px`;
      this.style.overflowY = 'hidden';
    }
  });

  this.append(controlsContainer);
  return this;
};

const defaults = {
  template: '<textarea class="form-control" rows="1" style="padding-right:96px;min-height:34px;max-height:200px;"></textarea>',
  parser: function (input) {
    return input ? String(input) : null;
  },
  isSingle: true,
};
