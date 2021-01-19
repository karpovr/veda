package main

import (
  "encoding/base64"
  "github.com/itiu/fasthttp"
  "io"
  "io/ioutil"
  "log"
  "net/url"
  "os"
  "strings"
  "time"
  "unicode/utf8"
  "path/filepath"
)

//uploadFile handles file uploading from request context
func uploadFile(ctx *fasthttp.RequestCtx, ticketKey string) {
  defer func() {
    if r := recover(); r != nil {
      log.Println("Recovered in uploadFile", r)
      ctx.Response.SetStatusCode(int(InternalServerError))
    }
  }()

  log.Printf("%v start upload file\n", ticketKey)

  //Get form from context
  form, err := ctx.Request.MultipartForm()
  if err != nil {
    log.Println("ERR!, REDING FORM: UPLOAD FILE: ", err)
    ctx.Response.SetStatusCode(int(InternalServerError))
    return
  }

  if form.Value["path"] == nil {
    log.Printf("ERR!, UPLOAD FILE: path not defined or null content, form=%v, request=%v\n", form, ctx.String())
    ctx.Response.SetStatusCode(int(InternalServerError))
    return
  }

  if len(form.Value["path"]) != 1 {
    log.Println("ERR!, UPLOAD FILE: invalid path, path=", form.Value["path"])
    ctx.Response.SetStatusCode(int(InternalServerError))
    return
  }

  //Getting path parts from form
  pathParts := strings.Split(form.Value["path"][0], "/")
  attachmentsPathCurr := attachmentsPath

  //Creating directories for file
  for i := 1; i < len(pathParts); i++ {
    attachmentsPathCurr += "/" + pathParts[i]
    os.Mkdir(attachmentsPathCurr, os.ModePerm)
  }
  path := attachmentsPathCurr + "/" + form.Value["uri"][0]

  if len(form.Value["content"]) > 0 {
    content := form.Value["content"][0]
    log.Printf("%v from [content], path=%v, size=%v\n", ticketKey, path, len(content))

    if len(content) > 0 {

      pos := strings.Index(content, "base64")
      if pos > 0 {
        //header := content[0:pos]
        cntstr := content[pos+6+1 : len(content)]
        decoded, err := base64.StdEncoding.DecodeString(cntstr)

        if err != nil {
          log.Println("ERR! Upload file: decode base64:", err)
          ctx.Response.SetStatusCode(int(InternalServerError))
          return
        }
        err = ioutil.WriteFile(path, decoded, 0644)
        if err != nil {
          log.Println("ERR! Upload file: write file:", err)
          ctx.Response.SetStatusCode(int(InternalServerError))
          return
        }
      }
    }
  } 

  if len(form.File["file"]) > 0 {

    log.Printf("%v from [file], path=%v\n", ticketKey, path)
    //Create file in destination directory
    destFile, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE, 0666)
    if err != nil {
      log.Println("ERR! CREATING DESTIONTION FILE ON UPLOAD: ", err)
      ctx.Response.SetStatusCode(int(InternalServerError))
      return
    }

    defer destFile.Close()
    //Open frime form

    srcFile, err := form.File["file"][0].Open()
    if err != nil {
      log.Println("ERR! OPENING FORM FILE ON UPLOAD: ", err)
      ctx.Response.SetStatusCode(int(InternalServerError))
      return
    }

    log.Printf("%v get file from client\n", ticketKey)

    defer srcFile.Close()

    //Copy srce file from form to destination
    file_size, err := io.Copy(destFile, srcFile)
    if err != nil {
      log.Println("ERR! ON COPYING FILE ON UPLOAD: ", err)
      ctx.Response.SetStatusCode(int(InternalServerError))
      return
    }

    log.Printf("%v writing file to server, size=%v\n", ticketKey, file_size)

    ctx.Response.SetStatusCode(int(Ok))
  } 

  log.Printf("%v end upload file\n", ticketKey)
}

//files is handler for this rest request, routeParts is parts of request path separated by slash
func files(ctx *fasthttp.RequestCtx, routeParts []string) {
  defer func() {
    if r := recover(); r != nil {
      log.Println("Recovered in files", r)
      ctx.Response.SetStatusCode(int(InternalServerError))
    }
  }()

  //Reqding client ticket key from request
  ticketKey := string(ctx.QueryArgs().Peek("ticket")[:])
  if len(ticketKey) == 0 {
    ticketKey = string(ctx.Request.Header.Cookie("ticket"))
  }
  timestamp := time.Now()

  uri := ""
  //if roup parts len is 2 or more than save uri and go to reading file,
  //else upload file from request context
  if len(routeParts) > 2 {
    uri = routeParts[2]
  } else {
    uploadFile(ctx, ticketKey)
    return
  }

  //If uri len is more then 3 and icket is valid than continue downloading
  if utf8.RuneCountInString(uri) > 3 {

    //Check if ticket is valid, return fail code if ticket is not valid
    rc, ticket := getTicket(ticketKey)
    if rc != Ok {
      log.Println("ERR! get file [%s], ticket [%s] not valid, err=%s", uri, ticketKey, rc)
      ctx.Response.SetStatusCode(int(rc))
      return
    }

    //Get individual of requested file from tarantool
    rr := conn.Get(true, ticket.UserURI, []string{uri}, false, false)

    //If common  request code of operation code are not Ok then return fail code
    if rr.CommonRC != Ok {
      log.Println("ERR! get file [%s], fail get info of file, ticket=%s, user=%s, err=%s", ticket.UserURI, ticketKey, uri, rr.CommonRC)
      ctx.Response.SetStatusCode(int(rr.CommonRC))
      return
    } else if rr.OpRC[0] != Ok {
      log.Println("ERR! get file [%s], fail get info of file, ticket=%s, user=%s, err=%s", ticket.UserURI, ticketKey, uri, rr.OpRC[0])
      ctx.Response.SetStatusCode(int(rr.OpRC[0]))
      return
    }

    fileInfo := rr.GetIndv(0)
    filePath, _ := getFirstString(fileInfo, "v-s:filePath")
    if len(filePath) < 3 {
      log.Println("ERR! file path is empty, uri=%s", uri)
      ctx.Response.SetStatusCode(int(InternalServerError))
      return
    }

    fileURI, _ := getFirstString(fileInfo, "v-s:fileUri")
    if len(fileURI) < 3 {
      log.Println("ERR! file uri is empty, uri=%s", uri)
      ctx.Response.SetStatusCode(int(InternalServerError))
      return
    }

    fileName, _ := getFirstString(fileInfo, "v-s:fileName")
    if len(fileName) < 1 {
      log.Println("ERR! file name is empty, uri=%s", uri)
      ctx.Response.SetStatusCode(int(InternalServerError))
      return
    }

    //Create path to file string
    filePathStr := attachmentsPath + filePath + "/" + fileURI

    //Check if file exists, return err code if not or InternalServerError if error occured
    _, err := os.Stat(filePathStr)
    if os.IsNotExist(err) {
      ctx.Response.SetStatusCode(int(NotFound))
      return
    } else if err != nil {
      log.Println("ERR! ON CHECK FILE EXISTANCE: ", err)
      ctx.Response.SetStatusCode(int(InternalServerError))
      return
    }

    //Return file to client
    eFileName := url.PathEscape(fileName)
    ctx.Response.Header.Set("Content-Disposition", "attachment; filename*=UTF-8''"+eFileName)
    fasthttp.ServeFileBytesUncompressed(ctx, []byte(filePathStr))

    var ext = filepath.Ext(fileName)
    log.Println("ext=", ext)

    if ext == ".docx" {
	ctx.Response.Header.Set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    }

    if ext == ".xlsx" {
	ctx.Response.Header.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    }

    if ext == ".pptx" {
	ctx.Response.Header.Set("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation")
    }

    trail1(ticket.Id, ticket.UserURI, "files", uri, "", Ok, timestamp)
  } else {
      log.Println("ERR! FILE uri < 3")
      ctx.Response.SetStatusCode(int(InternalServerError))
  }

}
