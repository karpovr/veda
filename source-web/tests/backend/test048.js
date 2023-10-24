export default ({test, assert, Backend, Helpers, Constants, Util}) => {
  test.skip('#034 File upload, webdav editing', async () => {
    const {ticket} = await Helpers.get_user1_ticket();

    const test_file_uri = Util.guid();
    const test_file_individual_uri = 'test-file:' + Util.guid();

    const test_file_individual = {
      '@': test_file_individual_uri,
      'rdf:type': Util.newUri('v-s:File'),
      'v-s:creator': Util.newUri('td:ValeriyBushenev-Programmer1'),
      'rdfs:label': Util.newStr('test.txt'),
      'v-s:fileName': Util.newStr('test.txt'),
      'v-s:filePath': Util.newStr('/1970/01/01'),
      'v-s:fileSize': Util.newInt(3),
      'v-s:fileUri': Util.newUri(test_file_uri),
    };

    const path = '/1970/01/01';
    const uri = test_file_uri;
    const content = '000';
    await uploadFile(ticket, path, uri, content);

    const res = await Backend.put_individual(ticket, test_file_individual);
    assert(await Backend.wait_module(Constants.m_acl, res.op_id));
    assert(await Backend.wait_module(Constants.m_scripts, res.op_id));

    const url = `http://localhost/webdav/${ticket}/${test_file_individual_uri}/test.txt`;
    const editedContent = Math.floor(900 * Math.random() + 100).toString();

    // Эмулируем серию запросов WebDAV
    await propfindRequest(url);
    await optionsRequest(url);
    await getRequest(url);
    await putRequest(url, editedContent);

    await timeout(1000);
    const newContent = await getRequest(url);
    assert(newContent === editedContent);
  });
};

// Функция загрузки файла на сервер
async function uploadFile (ticket, path, uri, content) {
  try {
    const boundary = '----WebKitFormBoundaryi6f7ZW0xH8ivVwZr';
    let formData = `--${boundary}\r\nContent-Disposition: form-data; name="path"\r\n\r\n${path}\r\n`;
    formData += `--${boundary}\r\nContent-Disposition: form-data; name="uri"\r\n\r\n${uri}\r\n`;
    formData += `--${boundary}\r\nContent-Disposition: form-data; name="content"\r\n\r\ndata:text/plain;base64,${Buffer.from(content).toString('base64')}\r\n`;
    formData += `--${boundary}--\r\n`;

    const response = await fetch('http://localhost/files', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Cookie': `ticket=${ticket}`,
      },
    });

    if (!response.ok) {
      throw new Error('File upload failed');
    }
  } catch (error) {
    console.error('File upload error:', error);
    throw error;
  }
}

// Таймаут
async function timeout (ms) {
  return new Promise((_) => setTimeout(_, ms));
}

// Функция для эмулирования запроса PROPFIND
async function propfindRequest (url) {
  try {
    const response = await fetch(url, {
      method: 'PROPFIND',
      headers: {
        'Content-Type': 'text/xml',
        'Depth': '1',
      },
      body: `
        <?xml version="1.0" encoding="utf-8" ?>
        <D:propfind xmlns:D="DAV:">
          <D:prop>
            <D:getcontenttype/>
            <D:getcontentlength/>
            <D:getlastmodified/>
            <D:resourcetype/>
          </D:prop>
        </D:propfind>
      `,
    });

    const data = await response.text();
    console.log('Ответ PROPFIND:', data);
  } catch (error) {
    console.error('Ошибка PROPFIND:', error);
  }
}

// Функция для эмулирования запроса OPTIONS
async function optionsRequest (url) {
  try {
    const response = await fetch(url, {method: 'OPTIONS'});

    const data = await response.text();
    console.log('Ответ OPTIONS:', data);
  } catch (error) {
    console.error('Ошибка OPTIONS:', error);
  }
}

// Функция для эмулирования запроса GET
async function getRequest (url) {
  try {
    const response = await fetch(url, {method: 'GET'});

    const data = await response.text();
    console.log('Ответ GET:', data);
    return data;
  } catch (error) {
    console.error('Ошибка GET:', error);
  }
}

// Функция для эмулирования запроса PUT
async function putRequest (url, content) {
  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain',
        'Content-Length': content.length,
      },
      body: content,
    });

    console.log('Ответ PUT:', response.status);
  } catch (error) {
    console.error('Ошибка PUT:', error);
  }
}
