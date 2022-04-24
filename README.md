[![Project Status: Active – The project has reached a stable, usable state and is being actively developed.](https://www.repostatus.org/badges/latest/active.svg)](https://www.repostatus.org/#active)
[![CI](https://github.com/semantic-machines/veda/actions/workflows/main.yml/badge.svg?branch=master)](https://github.com/semantic-machines/veda/actions/workflows/main.yml)

# Veda - ontology driven application development platform

![](https://github.com/semantic-machines/veda/blob/master/doc/images/intro.jpg)

## I. Overview

**1. Driven by Semantic Web methodology**
  - Veda platform pursues Semantic Web methodology for data description, storage and exchange (https://en.wikipedia.org/wiki/Semantic_Web).

**2. Two-tier architecture**
  - Thin server (stateless).
  - Rich browser-side web-client (stateful).

**3. Server components**
  - Tarantool database (https://www.tarantool.io)
  - Integrated Xapian search engine library. Used for data indexing & querying (http://xapian.org).
  - Integrated V8 javascript engine library. Used for workflow execution engine and other server-side logic (https://code.google.com/p/v8).
  - Fasthttp web server.
  - Nanomsg - light-weight messaging protocol library.

**4. Client components**
  - Bootstrap HTML, CSS, and JS framework for developing responsive, mobile first web applications (http://getbootstrap.com).

  - Riot.js a React-like user interface micro-library. Used for implementing MVC pattern & client-side routing (http://riotjs.com).

  - jQuery general purpose client-side javascript library. Used for client-server interaction, event handling, DOM traversal & manipulation (https://jquery.com).

  - jsPlumb visual connectivity library for webapps. Used for workflow viewer/editor (http://jsplumbtoolkit.com).

  - Various visualization libraries & plugins.



## II. System requirements
  - OS - Ubuntu 18.04, 20.04 LTS 64-Bit. For run on common Linux-based operating systems, use Veda-x86_64.AppImage

  - RAM - 1Gb



## III. How to install and run



**Installing a pre-built system**

You can download pre-built platform release from GitHub. To install the latest version, follow the link https://github.com/semantic-machines/veda/releases and download the Veda-x86_64.AppImage file into a separate folder. This file contains the packed platform binaries and required dependencies.

Make the file executable:
chmod +x Veda-x86_64.AppImage
and run it.

At the the first run, additional files will appear in the folder where the Veda-x86_64.AppImage file is located for subsequent start and stop of the application. A folder for the database will be created and the ontology will be unpacked. The ./install-tools/install-tarantool.sh file will also appear. If the Tarantool database has not been installed before, install it using install-tarantool.sh before the first start.



**Building from sources**

The sources for the project can be downloaded from the GitHub. To do this, run the command:
git clone https://github.com/semantic-machines/veda.git

The server side modules will require components from other developers. They are open source and can be installed by running the script:

```sh
$ ./control-install.sh
```

After installing all of the dependencies, you can build the executable files:

```sh
$ ./build.sh
```



**Setting up and running**

Settings for configuring the server are in the ./veda.properties file.

At the first, you may need to make changes to the tcp port settings. By default, the server will interact with the client using ports 8080 and 8088. If necessary, you can reconfigure them.

Web-application port is set by the *http_port* parameter (8080 by default). The second port is used for sending notifications of data changes to the client application and is set by the *ccus_port* parameter (8088 by default). The server is started with the command:

```sh
$ ./control-start.sh
```

At the first start, when the database is empty, it may take some time (about a minute), during which the platform ontology located in the ./ontology folder will be loaded to the database. Subsequent launches will take place without any delay, almost instantly. After the server side has started, you can go to the browser at http://localhost:8080.

It is possible to check the operability of the platform components, for this, in the browser, go to the address http://localhost:8080/ tests. Normally, all tests should pass successfully. The server can be stopped with the command:

```sh
$ ./control-stop.sh
```
