export default [
  {
    "request": {
      "id": 1,
      "method": "OPTIONS",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
      }
    },
    "response": {
      "status": "200",
      "headers": {
        "allow": "GET,HEAD,PUT,OPTIONS,DELETE,PROPFIND,COPY,MOVE",
        "dav": "1,2",
      }
    }
  },
  {
    "request": {
      "id": 2,
      "method": "PROPFIND",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "231",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><prop><resourcetype xmlns=\"DAV:\"/><IsReadOnly xmlns=\"http://ucb.openoffice.org/dav/props/\"/><getcontenttype xmlns=\"DAV:\"/><supportedlock xmlns=\"DAV:\"/></prop></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
      },
    }
  },
  {
    "request": {
      "id": 3,
      "method": "PROPFIND",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "144",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><prop><IsReadOnly xmlns=\"http://ucb.openoffice.org/dav/props/\"/></prop></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
      },
    }
  },
  {
    "request": {
      "id": 4,
      "method": "GET",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
      }
    },
    "response": {
      "status": "200",
      "headers": {
        "last-modified": "",
        "etag": "",
        "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document; charset=UTF-8",
        "content-disposition": "",
        "accept-ranges": "bytes",
        "content-length": "",
      }
    }
  },
  {
    "request": {
      "id": 5,
      "method": "PROPFIND",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "141",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><prop><BaseURI xmlns=\"http://ucb.openoffice.org/dav/props/\"/></prop></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
        "content-length": "",
      },
    }
  },
  {
    "request": {
      "id": 6,
      "method": "PROPFIND",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "115",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><prop><supportedlock xmlns=\"DAV:\"/></prop></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
        "content-length": "",
      },
    }
  },
  {
    "request": {
      "id": 7,
      "method": "PROPFIND",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "117",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><prop><getlastmodified xmlns=\"DAV:\"/></prop></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
        "content-length": "",
      },
    }
  },
  {
    "request": {
      "id": 8,
      "method": "PROPFIND",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "84",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><propname/></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
        "content-length": "",
      },
      "body": "<?xml version=\"1.0\" encoding=\"utf-8\" ?>\n<D:multistatus xmlns:D=\"DAV:\">\n<D:response>\n<D:href>/file0.docx</D:href>\n<D:propstat>\n<D:prop>\n<D:displayname>file0.docx</D:displayname>\n<D:getcontentlength>6928</D:getcontentlength>\n<D:getlastmodified>Wed, 25 Oct 2023 11:21:04 +0000</D:getlastmodified>\n<D:resourcetype></D:resourcetype>\n</D:prop>\n<D:status>HTTP/1.1 200 OK</D:status>\n</D:propstat>\n</D:response>\n</D:multistatus>"
    }
  },
  {
    "request": {
      "id": 9,
      "method": "PROPFIND",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "116",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><prop><getcontenttype xmlns=\"DAV:\"/></prop></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
        "content-length": "",
      },
    }
  },
  {
    "request": {
      "id": 10,
      "method": "PROPFIND",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "117",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><prop><getlastmodified xmlns=\"DAV:\"/></prop></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
        "content-length": "",
      },
    }
  },
  {
    "request": {
      "id": 11,
      "method": "PROPFIND",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "115",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><prop><supportedlock xmlns=\"DAV:\"/></prop></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
        "content-length": "",
      },
    }
  },
  {
    "request": {
      "id": 12,
      "method": "PROPFIND",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "117",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><prop><getlastmodified xmlns=\"DAV:\"/></prop></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
        "content-length": "",
      },
    }
  },
  {
    "request": {
      "id": 13,
      "method": "PROPFIND",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "142",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><prop><ObjectId xmlns=\"http://ucb.openoffice.org/dav/props/\"/></prop></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
        "content-length": "",
      },
    }
  },
  {
    "request": {
      "id": 14,
      "method": "OPTIONS",
      "path": "/",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
      }
    },
    "response": {
      "status": "200",
      "headers": {
        "allow": "GET,HEAD,PUT,OPTIONS,DELETE,PROPFIND,COPY,MOVE",
        "dav": "1,2",
      }
    }
  },
  {
    "request": {
      "id": 15,
      "method": "PROPFIND",
      "path": "/",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "231",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><prop><resourcetype xmlns=\"DAV:\"/><IsReadOnly xmlns=\"http://ucb.openoffice.org/dav/props/\"/><getcontenttype xmlns=\"DAV:\"/><supportedlock xmlns=\"DAV:\"/></prop></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
        "content-length": "",
      },
    }
  },
  {
    "request": {
      "id": 16,
      "method": "PROPFIND",
      "path": "/",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "155",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><prop><CreatableContentsInfo xmlns=\"http://ucb.openoffice.org/dav/props/\"/></prop></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
        "content-length": "",
      },
    }
  },
  {
    "request": {
      "id": 17,
      "method": "PUT",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-length": "3",
      },
      "body": "111"
    },
    "response": {
      "status": "201",
      "headers": {
        "content-length": "0",
      }
    }
  },
  {
    "request": {
      "id": 18,
      "method": "PROPFIND",
      "path": "/",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "115",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><prop><supportedlock xmlns=\"DAV:\"/></prop></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
        "content-length": "",
      },
    }
  },
  {
    "request": {
      "id": 19,
      "method": "OPTIONS",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
      }
    },
    "response": {
      "status": "200",
      "headers": {
        "allow": "GET,HEAD,PUT,OPTIONS,DELETE,PROPFIND,COPY,MOVE",
        "dav": "1,2",
      }
    }
  },
  {
    "request": {
      "id": 20,
      "method": "PROPFIND",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "115",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><prop><supportedlock xmlns=\"DAV:\"/></prop></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
        "content-length": "",
      },
    }
  },
  {
    "request": {
      "id": 21,
      "method": "PROPFIND",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "117",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><prop><getlastmodified xmlns=\"DAV:\"/></prop></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
        "content-length": "",
      },
    }
  },
  {
    "request": {
      "id": 22,
      "method": "PROPFIND",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "84",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><propname/></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
        "content-length": "",
      },
    }
  },
  {
    "request": {
      "id": 23,
      "method": "PROPFIND",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "231",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><prop><resourcetype xmlns=\"DAV:\"/><IsReadOnly xmlns=\"http://ucb.openoffice.org/dav/props/\"/><getcontenttype xmlns=\"DAV:\"/><supportedlock xmlns=\"DAV:\"/></prop></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
        "content-length": "",
      },
    }
  },
  {
    "request": {
      "id": 24,
      "method": "PROPFIND",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "117",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><prop><getlastmodified xmlns=\"DAV:\"/></prop></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
        "content-length": "",
      },
    }
  },
  {
    "request": {
      "id": 25,
      "method": "PROPFIND",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "231",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><prop><resourcetype xmlns=\"DAV:\"/><IsReadOnly xmlns=\"http://ucb.openoffice.org/dav/props/\"/><getcontenttype xmlns=\"DAV:\"/><supportedlock xmlns=\"DAV:\"/></prop></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
        "content-length": "",
      },
    }
  },
  {
    "request": {
      "id": 26,
      "method": "PROPFIND",
      "path": "/file0.docx",
      "headers": {
        "accept": "*/*",
        "accept-encoding": "deflate, gzip, br, zstd",
        "content-type": "application/xml",
        "depth": "0",
        "content-length": "117",
      },
      "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<propfind xmlns=\"DAV:\"><prop><getlastmodified xmlns=\"DAV:\"/></prop></propfind>"
    },
    "response": {
      "status": "207",
      "headers": {
        "content-type": "application/xml; charset=utf-8",
        "content-length": "",
      },
    }
  }
];