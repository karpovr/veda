import $ from 'jquery';

export const pre = async function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const targetProperty = container.attr('target-property');
  const disableHeader = container.attr('disable-header');
  if (!targetProperty) {
    throw new Error('Target property is not set');
  }
  if (!individual.hasValue(targetProperty)) {
    template.hide();
    return;
  } else {
    $('#table-body', template).attr('rel', targetProperty);
  }
  if (disableHeader) {
    $('#table-header', template).hide();
  }

  individual.on(targetProperty, () => {
    if (individual.hasValue(targetProperty)) {
      template.show();
    } else {
      template.hide();
    }
  });
};

export const post = async function (individual, template, container, mode, extra) {
  template = $(template);
  container = $(container);

  const withComment = container.attr('with-comment');
  const signable = container.attr('with-btn');
  const targetProperty = container.attr('target-property');

  async function checkVisibility () { 
    if (!await isSignedFiles(individual[targetProperty])) {
      $('.signatures', template).remove();
    } 
    if (!withComment) {
      $('.comment', template).remove();
    }
    if (!signable) {
      $('.sign-action', template).remove();
    }
  }

  async function isSignedFiles (files) {
    for (const file of files) {
      await file.load();
      if (file.hasValue('v-s:digitalSignature')) {
        return true;
      }
    }
    return false;
  }

  checkVisibility();
  individual.on(targetProperty, checkVisibility);
};


export const html = `
  <div>
    <style scoped>
      .row-container {
          display: flex;
          border: 1px solid #ddd;
          border-bottom: none;
        }
        .file {
          flex: 1;
          border-right: 1px solid #ddd;
          padding: 8px;
        }
        .signatures {
          flex: 2;
          display: flex;
          flex-direction: column;
          min-height: 100%;
        }
        .signature-row {
          display: flex;
          border-bottom: 1px solid #ddd;
          flex: 1;
        }
        .signature {
          flex: 2;
          padding: 8px;
          border-right: 1px solid #ddd;
        }
        .sign-description {
          max-width: 60px;
          flex: 1;
          padding: 8px;
          text-align: center;
        }
        .signature:last-child, .description:last-child {
          border-right: none;
        }
        .signature-row:last-child {
          border-bottom: none;
        }
        .row-container:last-child {
          border-bottom: 1px solid #ddd;
        }
        .comment {
          flex: 1;
          padding: 8px;
          display: flex;
          border-left: 1px solid #ddd;
          align-items: center;
        }
        .sign-action {
          flex: 1;
          display: flex;
          padding: 8px;
          justify-content: center;
          align-items: center;
          border-right: 1px solid #ddd;
          max-width: 50px;
        } 
    </style>
    <div class="row-container" id="table-header">
      <div class="sign-action">
      </div>
      <div class="file">
        <strong about="v-s:File" property="rdfs:label"></strong>
      </div>
      <div class="signatures">
        <div class="signature-row">
          <div class="signature">
            <strong about="v-ui:DigitalSignatureBundle" property="rdfs:label"></strong>
          </div>
        </div>
      </div>
      <div class="comment">
        <strong about="rdfs:comment" property="rdfs:label"></strong>
      </div>
    </div>
    <div id="table-body" rel="v-s:attachment" data-template="v-ui:AttachmentTableRowTemplate" data-embedded="true"></div>
  </div>
`;
