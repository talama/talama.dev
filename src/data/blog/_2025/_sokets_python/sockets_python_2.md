---
title: Understanding sockets with Python - Part 2
author: Luca Salomoni
date: 2025-09-24T19:13:34.861Z
featured: true
draft: false
categories:
  - Networking
tags:
  - Sockets
  - Python
description: >-
  In Part 2 we continue looking at sockets (and a little HTTP) by writing a
  simple client that can connect to our server. At the end of the post we will
  have a client that can make a valid HTTP request to a web server and process
  the response.
---
This is the second part in a series of posts where we'll explore what sockets are
and how we can use them to communicate over a network, by writing some simple client/server code in Python.

At the end of the post we will have a
client that can make a valid HTTP request to a web server and process the
response.

## Table of contents

## The Client

In [part 1](sockets_python_1) we covered quite a bit of ground on the **socket API** so now writing a simple client should prove to be easy.

But what does a client do? It:

- **Asks the OS for a socket that matches the server's family and type**
- **Connects to the server socket**
- **Sends and receives data**
- **Closes the connection**

In our case we know that the server address will be **(127.0.0.1, 35555)**,
but if we'd use a **hostname**, `socket.connect((hostname, port))` would perform a **DNS lookup** for us.

We can also use `socket.getaddrinfo(host, port, family=AF_UNSPEC, type=0, proto=0, flags=0)`
to "translate" the **host/port** argument into a sequence of 5-tuples that contains all the necessary arguments to create a socket connected to that service.

The *family*, *type* and *proto* arguments can be optionally specified in order to
limit the list of addresses returned.

So for example:

```python
import socket

HOST = "example.org"
PORT = 80

results = socket.getaddrinfo(
    HOST,
    PORT,
    family=socket.AF_INET,
    type=socket.SOCK_STREAM,
    proto=socket.IPPROTO_TCP,
    flags=socket.AI_CANONNAME,
)

for res in results:
    family, sock_type, proto, canonname, addr = res
    if res:
        print(f"Address: {addr}")
        print(f"Family: {socket.AddressFamily(family).name}")
        print(f"Type: {socket.SocketKind(sock_type).name}")
        print(f"Protocol: {proto}")
        print(f"Canonname: {canonname if canonname else '-'}")
        print("-" * 40)
```

when run will give us:

```bash
Address: ('23.220.75.238', 80)
Family: AF_INET
Type: SOCK_STREAM
Protocol: 6
Canoname: example.org
----------------------------------------
Address: ('23.215.0.132', 80)
Family: AF_INET
Type: SOCK_STREAM
Protocol: 6
Canoname: -
----------------------------------------
Address: ('23.215.0.133', 80)
Family: AF_INET
Type: SOCK_STREAM
Protocol: 6
Canoname: -
----------------------------------------
Address: ('23.220.75.235', 80)
Family: AF_INET
Type: SOCK_STREAM
Protocol: 6
Canoname: -
----------------------------------------
```

All that is left to do at this point is to write our simple client. Nothing special going on here:

```python
// file: simple_client.py
import socket

from utils.logger import get_logger

logger = get_logger("client")


def start_client(
    host: str = "127.0.0.1", port: int = 35555, message: str = "Hello, world!"
):
    """
    Create a simple socket client that sends a message to a server
    and receives a message back.
    """

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as client:
        try:
            logger.info("Connecting...")
            client.connect((host, port))
            logger.info("Connected to server at %s:%d", host, port)

            logger.info("Sending: %s", message)
            client.sendall(message.encode("utf-8"))

            data = client.recv(1024)
            logger.info("Received: %s", data.decode("utf-8"))

        except ConnectionRefusedError:
            logger.error("Connection refused.")
        except OSError as e:
            logger.error("Client error: %s", e)


if __name__ == "__main__":
    start_client(message="This is a test message from the client.")
```

We create a socket with the same `socket family` (**AF_INET**) and the same `socket type` (**SOCK_STREAM**) as the server,
then we `connect()` to the server address **(host, port)**.

Now if we run the server and then try to connect with the client while the server is listening:

```bash
❯ uv run simple_server.py
17-09-2025 18:34:35 - INFO - server - Starting server...
17-09-2025 18:34:35 - INFO - server - Listening on port: 35555
```

```bash
❯ uv run simple_client.py
17-09-2025 18:34:52 - INFO - client - Connecting...
17-09-2025 18:34:52 - INFO - client - Connected to server at 127.0.0.1:35555
17-09-2025 18:34:52 - INFO - client - Sending: This is a test message from the client.
```

```bash {4,5}
17-09-2025 18:34:35 - INFO - server - Starting server...
17-09-2025 18:34:35 - INFO - server - Listening on port: 35555
17-09-2025 18:34:52 - INFO - server - Accepted connection from: ('127.0.0.1', 59218)
17-09-2025 18:34:52 - INFO - server - Received: This is a test message from the client.
17-09-2025 18:34:52 - INFO - server - Sending to ('127.0.0.1', 59218): This is a test message
```

```bash {4}
17-09-2025 18:34:52 - INFO - client - Connecting...
17-09-2025 18:34:52 - INFO - client - Connected to server at 127.0.0.1:35555
17-09-2025 18:34:52 - INFO - client - Sending: This is a test message from the client.
17-09-2025 18:34:52 - INFO - client - Received: This is a test message from the client.
```

So now we have a working, albeit **very simple**, client/server pair built using the socket API.

Both client and server request the OS a socket with the same **family/type**, the server binds to an address and listens, while the client connects.
They then proceed to **send/recv** data. Making sense of what the data means, and how to process it, is up to the developer (you).

## (Miss)Communication Breakdown

To show you why `protocols` (rules that establish how the communication should happen) are so important, and also to show you how the socket API only cares about connecting compatible endpoints, we can do a little experiment.

Our simple client creates a **TCP/IP** socket. Now we happen to know that **HTTP** is an application protocol that also uses **TCP** at the transport layer, and **IP** at the network layer.
So what if we use our client to connect to a web server like the one running this blog?

All we have to do is change the address to (**talama.dev, 80**):

```python {11}
//file: simple_client.py

import socket

from utils.logger import get_logger

logger = get_logger("client")


def start_client(
    host: str = "talama.dev", port: int = 80, message: str = "Hello, world!"
):
    """
    Create a simple socket client that sends a message to a server
    and receives a message back.
    """

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as client:
        [...]
```

If we run our client now, we get:

```bash
❯ uv run simple_client.py
17-09-2025 21:29:09 - INFO - client - Connecting...
17-09-2025 21:29:09 - INFO - client - Connected to server at talama.dev:80
17-09-2025 21:29:09 - INFO - client - Sending: This is a test message from the client.
17-09-2025 21:29:09 - INFO - client - Received: HTTP/1.1 400 Bad Request
Server: cloudflare
Date: Thu, 18 Sep 2025 19:29:09 GMT
Content-Type: text/html
Content-Length: 155
Connection: close
CF-RAY: -

<html>
<head><title>400 Bad Request</title></head>
<body>
<center><h1>400 Bad Request</h1></center>
<hr><center>cloudflare</center>
</body>
</html>
```

As you can see the connection part of the interaction between the server and the client works just fine.
(Notice also how `client.connect()` does the **DNS lookup** of the hostname for us).

But then we send a message that the web server doesn't know how to interpret, so it responds with a `400 Bad Request` error.
/Some servers will answer differently, but most of the times you will either get a `400 Bad Request`,
or your client will hang until it gets `408 Request Timeout` from the server.

This is what you get if you try to connect to (**example.org, 80**)

```bash
❯ uv run simple_client.py
17-09-2025 21:33:03 - INFO - client - Connecting...
17-09-2025 21:33:03 - INFO - client - Connected to server at example.org:80
17-09-2025 21:33:03 - INFO - client - Sending: This is a test message from the client.
17-09-2025 21:33:23 - INFO - client - Received: HTTP/1.0 408 Request Time-out
Server: AkamaiGHost
Mime-Version: 1.0
Date: Thu, 18 Sep 2025 19:33:23 GMT
Content-Type: text/html
Content-Length: 314
Expires: Thu, 18 Sep 2025 19:33:23 GMT

<HTML><HEAD> e
<TITLE>Request Timeout</TITLE>
</HEAD><BODY>
<H1>Request Timeout</H1>
The server timed out while waiting for the browser's request.<P>
Reference&#32;&#35;2&#46;85f6d517&#46;1758224003&#46;0
<P>https&#58;&#47;&#47;errors&#46;edgesuite&#46;net&#47;2&#46;85f6d517&#46;1758224003&#46;0</P
>
</BODY></HTML>
```

In both instances the TCP handshake and the packet delivery over IP succeeded, the failure was entirely at the **application layer**.

So what if we taught the client to speak HTTP, even just a little?

## The client learns some HTTP

But how does someone learn HTTP?

![one actually does](@/assets/images/onedoesnot.jpg)

Currently HTTP/1.1 is defined by:

- [RFC 9112 - HTTP/1.1](https://www.rfc-editor.org/rfc/rfc9112.html)
- [RFC 9110 - HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
- [RFC 9111 - HTTP Caching](https://www.rfc-editor.org/rfc/rfc9111.html)

Not the easiest read, but very interesting. Fortunately we only need a **very** small subset of the
information contained there (at least for now). And we are not going to reference the caching RFC at all.

The syntax of the messages is defined in **RFC 9112**, while the **semantics of methods, status codes, and header fields**
are defined separately in **RFC 9110**.

At its simplest, a request has this structure ( [RFC 9112, Section 2.1](https://www.rfc-editor.org/rfc/rfc9112.html#name-message-format) ):

```bash
  HTTP-message   = start-line CRLF
                   *( field-line CRLF )
                   CRLF
                   [ message-body ]
```

where `start-line` can be either a `request-line` or a `status-line` depending on whether this is a request or a response,
`*( field-line CRLF )` is **zero or more** header field lines, `CRLF` is an empty line (Carriage return + Line feed `\r\n`) and
`[message-body]` is an **optional** message body.

A `request line` ( [RFC 9112, Section 3](https://www.rfc-editor.org/rfc/rfc9112.html#name-request-line) ) is defined as
`Method request-target HTTP-version`.

In our case the `Method` will be **GET** since we want to *get* the home page, the `request-target` will be `/` (the top level entry point, the "document root")
and `HTTP-version` will be **HTTP/1.1**.

So our request line is:

```bash
GET / HTTP/1.1\r\n
```

What about the header field lines? ( [RFC 9112, Section 3.2](https://www.rfc-editor.org/rfc/rfc9112.html#name-request-target) ) says:

> A client MUST send a Host header field (Section 7.2 of [HTTP](https://www.rfc-editor.org/rfc/rfc9110#section-7.2)) in all HTTP/1.1 request messages.

Which brings us to:

```bash
GET / HTTP/1.1\r\n
Host: example.org\r\n
```

Notice that if we intend to close the connection on the client side after we receive the first response from the server, we should also send a:

```bash
Connection: close\r\n
```

header, or the server might keep the connection open since **HTTP/1.1** defaults to the use of *persistent connections* allowing multiple requests and responses to be carried over a single connection. ( [RFC 9112, Section 9.3](https://www.rfc-editor.org/rfc/rfc9112.html#name-persistence) ).

Which brings us to the final version of our very first HTTP "sentence":

```bash
GET / HTTP/1.1\r\n
Host: example.org\r\n
Connection: close\r\n
\r\n
```

We are ready to modify our client:

```python {8, 12, 37 } ShowLineNumbers
// file: simple_client.py
import socket

from utils.logger import get_logger

logger = get_logger("client")

REQUEST = "GET / HTTP/1.1\r\nHost: example.org\r\nConnection: close\r\n\r\n"


def start_client(
    host: str = "example.org", port: int = 80, message: str = "Hello, world!"
):
    """
    Create a simple socket client that sends a
    GET request to a web server message to a server
    and reads the response.
    """

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as client:
        try:
            logger.info("Connecting...")
            client.connect((host, port))
            logger.info("Connected to server at %s:%d", host, port)

            logger.info("Sending: %s", message)
            client.sendall(message.encode("utf-8"))

            data = client.recv(1024)
            logger.info("Received: %s", data.decode("utf-8"))

        except ConnectionRefusedError:
            logger.error("Connection refused. Make sure the server is running.")
        except OSError as e:
            logger.error("Client error: %s", e)


if __name__ == "__main__":
    start_client(message=REQUEST)
```

When we run it, we get:

```bash
19-09-2025 19:31:39 - INFO - client - Connecting...
19-09-2025 19:31:39 - INFO - client - Connected to server at example.org:80
19-09-2025 19:31:39 - INFO - client - Sending: GET / HTTP/1.1
Host: example.org
Connection: close


19-09-2025 19:31:39 - INFO - client - Received: HTTP/1.1 200 OK
Content-Type: text/html
ETag: "84238dfc8092e5d9c0dac8ef93371a07:1736799080.121134"
Last-Modified: Mon, 13 Jan 2025 20:11:20 GMT
Cache-Control: max-age=86000
Date: Fri, 19 Sep 2025 17:31:39 GMT
Content-Length: 1256
Connection: close
X-N: S

<!doctype html>
<html>
<head>
    <title>Example Domain</title>

    <meta charset="utf-8" />
    <meta http-equiv="Content-type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style type="text/css">
    body {
        background-color: #f0f0f2;
        margin: 0;
        padding: 0;
        font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;

    }
    div {
        width: 600px;
        margin: 5em auto;
        padding: 2em;
        background-color: #fdfdff;
        border-radius: 0.5em;
        box-shadow: 2px 3px 7px 2px rgba(0,0,0,0.02);
    }
    a:link, a:visited {
        color: #38
```

Success!! (kind of).

We received a meaningful response because we made meaningful request.
Too bad we only got the first **1024** bytes of it...

How do we read the full response? Well we sent `Connection: close` as header in our request,
so we know the server is going to send a response and then close the connection.
So we can simply just read **chunks** of **bufsize** until the server closes the connection and
sends **0 bytes** (`b""`).

It's not perfect, but it works in this case and it's easy to implement:

```python {27-34}
// file: simple_client.py
import socket

from utils.logger import get_logger

logger = get_logger("client")

REQUEST = "GET / HTTP/1.1\r\nHost: example.org\r\nConnection: close\r\n\r\n"


def start_client(
    host: str = "example.org", port: int = 80, message: str = "Hello, world!"
):
    """
    Create a simple socket client that sends a
    GET request to a web server message to a server
    and reads the response.
    """

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as client:
        try:
            logger.info("Connecting...")
            client.connect((host, port))
            logger.info("Connected to server at %s:%d", host, port)

            logger.info("Sending: %s", message)
            client.sendall(message.encode("utf-8"))

            res = b""
            while True:
                chunk = client.recv(1024)
                if not chunk:
                    break
                res += chunk

            print(res.decode("utf-8"))

        except ConnectionRefusedError:
            logger.error("Connection refused. Make sure the server is running.")
        except OSError as e:
            logger.error("Client error: %s", e)


if __name__ == "__main__":
    start_client(message=REQUEST)
```

We get:

```bash
❯ uv run simple_client.py
19-09-2025 19:33:28 - INFO - client - Connecting...
19-09-2025 19:33:28 - INFO - client - Connected to server at example.org:80
19-09-2025 19:33:28 - INFO - client - Sending: GET / HTTP/1.1
Host: example.org
Connection: close


HTTP/1.1 200 OK
Content-Type: text/html
ETag: "84238dfc8092e5d9c0dac8ef93371a07:1736799080.121134"
Last-Modified: Mon, 13 Jan 2025 20:11:20 GMT
Cache-Control: max-age=86000
Date: Fri, 19 Sep 2025 20:33:29 GMT
Content-Length: 1256
Connection: close
X-N: S

<!doctype html>
<html>
<head>
    <title>Example Domain</title>

    <meta charset="utf-8" />
    <meta http-equiv="Content-type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style type="text/css">
    body {
        background-color: #f0f0f2;
        margin: 0;
        padding: 0;
        font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;

    }
    div {
        width: 600px;
        margin: 5em auto;
        padding: 2em;
        background-color: #fdfdff;
        border-radius: 0.5em;
        box-shadow: 2px 3px 7px 2px rgba(0,0,0,0.02);
    }
    a:link, a:visited {
        color: #38488f;
        text-decoration: none;
    }
    @media (max-width: 700px) {
        div {
            margin: 0 auto;
            width: auto;
        }
    }
    </style>
</head>

<body>
<div>
    <h1>Example Domain</h1>
    <p>This domain is for use in illustrative examples in documents. You may use this
    domain in literature without prior coordination or asking for permission.</p>
    <p><a href="https://www.iana.org/domains/example">More information...</a></p>
</div>
</body>
</html>
```

Now we can say... Success!! We got the full response!

But... What if we didn't send the `Connection: close` header?
[RFC 9112, Section 9.3](https://www.rfc-editor.org/rfc/rfc9112.html#name-persistence) explains how:

> HTTP/1.1 defaults to the use of "persistent connections", allowing multiple requests and responses to be carried over a single connection. HTTP implementations **SHOULD** support persistent connections.

Opening a new TCP connection for every request is expensive (3-way handshake, slow start, TLS handshake if HTTPS), so for example we might
want to request **/index.html**, **/style.css**, **/main.js** all over the same connection if the server supports it.

Notice also that there is a bug in our current implementation. If we remove the `Connection: close` header, our `While: True` never ends:

```python {3-5}
            res = b""
            while True:
                chunk = client.recv(1024)
                if not chunk:
                    break
                res += chunk

```

Remember that `recv()` **is blocking** meaning it will sit there waiting for the server to say something.
The loop only breaks when the server closes the connection and sends **0 bytes** (an empty `b""`), so
it would potentially never end.

In the case of `example.org` the loop will eventually end when the server times out and closes the connection, the client
will then print the response and close.

How can we create a more robust solution?
Time to use your head(ers)!

## It's all in your Head(ers)

The idea is to use the `Content-Length: body-length` header to know how many bytes we should read.

We know from ( [RFC 9112, Section 2.1](https://www.rfc-editor.org/rfc/rfc9112.html#name-message-format) )
that the end of the headers part of the message is delimited by `\r\n\r\n`,
so we can `recv()` from the server until we find that delimiter, then search the headers for `Content-Length: body-length`
and finally call `recv()` in a loop until we have received `body-length` bytes.

Let's first get all the headers:

```python title="simple_client.py" {26-41}
import socket

from utils.logger import get_logger

logger = get_logger("client")

REQUEST = "GET / HTTP/1.1\r\nHost: example.org\r\n\r\n"


def start_client(
    host: str = "example.org", port: int = 80, message: str = "Hello, world!"
):
    """
    Create a simple socket client that sends a
    GET request to a web server message to a server
    and reads the response.
    """

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as client:
        try:
            logger.info("Connecting...")
            client.connect((host, port))
            logger.info("Connected to server at %s:%d", host, port)

            logger.info("Sending: %s", message)
            client.sendall(message.encode("utf-8"))

            buffer = b""
            while b"\r\n\r\n" not in buffer:
                chunk = client.recv(1024)
                buffer += chunk

            # Depending on where in the buffer was "\r\n\r\n"
            # when we exit the loop we probably have read some of the body
            # already in the buffer, so we assign it to body
            headers, body = buffer.split(b"\r\n\r\n", 1)
            headers = headers.decode("utf-8").split("\r\n")

            logger.info("Received headers:")
            for h in headers:
                print(h)

        except ConnectionRefusedError:
            logger.error("Connection refused. Make sure the server is running.")
        except OSError as e:
            logger.error("Client error: %s", e)


if __name__ == "__main__":
    start_client(message=REQUEST)
```

When we run it we get:

```bash
❯ uv run simple_client.py
20-09-2025 22:22:58 - INFO - client - Connecting...
20-09-2025 22:22:58 - INFO - client - Connected to server at example.org:80
20-09-2025 22:22:58 - INFO - client - Sending: GET / HTTP/1.1
Host: example.org


20-09-2025 22:22:58 - INFO - client - Received headers:
HTTP/1.1 200 OK
Content-Type: text/html
ETag: "84238dfc8092e5d9c0dac8ef93371a07:1736799080.121134"
Last-Modified: Mon, 13 Jan 2025 20:11:20 GMT
Cache-Control: max-age=86000
Date: Sat, 20 Sep 2025 20:22:58 GMT
Content-Length: 1256
Connection: keep-alive
```

Notice, again that the choice of **1024** as `bufsize` is an arbitrary number I picked for this tutorial, and that it's the **max** amount of data we can receive at once,
but we could also be receiving **less** than `bufsize`.
It's small enough to show a couple of `recv()` iterations, but big enough to avoid a ton of tiny reads.

Moving on, now that we have our `headers` we can look for `Content-Length:` and find how many bytes the body is.
Then we can read however many bytes we have left (we have most likely already read some of the body).

```python title="simple_client.py" {36-45}

import socket

from utils.logger import get_logger

logger = get_logger("client")

REQUEST = "GET / HTTP/1.1\r\nHost: example.org\r\n\r\n"


def start_client(
    host: str = "example.org", port: int = 80, message: str = "Hello, world!"
):
    """
    Create a simple socket client that sends a
    GET request to a web server message to a server
    and reads the response.
    """

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as client:
        try:
            logger.info("Connecting...")
            client.connect((host, port))
            logger.info("Connected to server at %s:%d", host, port)

            logger.info("Sending: %s", message)
            client.sendall(message.encode("utf-8"))

            buffer = b""
            while b"\r\n\r\n" not in buffer:
                chunk = client.recv(1024)
                buffer += chunk

            headers, body = buffer.split(b"\r\n\r\n", 1)
            headers = headers.decode("utf-8").split("\r\n")

            body_length: int = 0
            for h in headers:
                if h.lower().startswith("content-length:"):
                    body_length = int(h.split(":", 1)[1].strip())
                print(h)

            while len(body) < body_length:
                chunk = client.recv(1024)
                body += chunk
            print(body.decode("utf-8"))

        except ConnectionRefusedError:
            logger.error("Connection refused. Make sure the server is running.")
        except OSError as e:
            logger.error("Client error: %s", e)


if __name__ == "__main__":
    start_client(message=REQUEST)
```

And now, finally:

```bash
❯ uv run simple_client.py
20-09-2025 22:27:27 - INFO - client - Connecting...
20-09-2025 22:27:27 - INFO - client - Connected to server at example.org:80
20-09-2025 22:27:27 - INFO - client - Sending: GET / HTTP/1.1
Host: example.org


HTTP/1.1 200 OK
Accept-Ranges: bytes
Content-Type: text/html
ETag: "84238dfc8092e5d9c0dac8ef93371a07:1736799080.121134"
Last-Modified: Mon, 13 Jan 2025 20:11:20 GMT
Content-Length: 1256
Cache-Control: max-age=86000
Date: Sat, 20 Sep 2025 20:27:27 GMT
Connection: keep-alive
<!doctype html>
<html>
<head>
    <title>Example Domain</title>

    <meta charset="utf-8" />
    <meta http-equiv="Content-type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style type="text/css">
    body {
        background-color: #f0f0f2;
        margin: 0;
        padding: 0;
        font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", "Open Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;

    }
    div {
        width: 600px;
        margin: 5em auto;
        padding: 2em;
        background-color: #fdfdff;
        border-radius: 0.5em;
        box-shadow: 2px 3px 7px 2px rgba(0,0,0,0.02);
    }
    a:link, a:visited {
        color: #38488f;
        text-decoration: none;
    }
    @media (max-width: 700px) {
        div {
            margin: 0 auto;
            width: auto;
        }
    }
    </style>
</head>

<body>
<div>
    <h1>Example Domain</h1>
    <p>This domain is for use in illustrative examples in documents. You may use this
    domain in literature without prior coordination or asking for permission.</p>
    <p><a href="https://www.iana.org/domains/example">More information...</a></p>
</div>
</body>
</html>
```

Great! We finally managed to properly connect to a web server, send a valid **GET request** and correctly read the **response**!

Unfortunately if we try to connect to other web servers we are most likely going to encounter a few problems.

First of all, we are not supporting `HTTPS` and almost all public websites enforce it nowadays (and if a website doesn't, you probably shouldn't trust it).

Second, determining the `body-length` is not as easy as it sounds because `Content-Length:` is not the only header that we would need to support,
we should at least support `Transfer-Encoding: chunked`.

As always we must refer to our good ol' friend [RFC 9112, Section 6.3](https://www.rfc-editor.org/rfc/rfc9112.html#name-message-body-length)
where we can see that things are quite more complicated than we initially thought.

We might update our client in the next part of this series, but for now what if we taught our **simple server** some HTTP too?

## The server learns some HTTP too

We are going to modify our server to parse a well-formed **HTTP request** and respond properly.

Remember from [RFC 9112, Section 2.1](https://www.rfc-editor.org/rfc/rfc9112.html#name-message-format) that:

```bash
  HTTP-message   = start-line CRLF
                   *( field-line CRLF )
                   CRLF
                   [ message-body ]
```

And `start-line` in the case of a response is a `status-line` [RFC 9112, Section 4](https://www.rfc-editor.org/rfc/rfc9112.html#name-status-line)

```bash
 status-line = HTTP-version status-code [ reason-phrase ]
```

Status codes are described in [RFC 9110, Section 15](https://www.rfc-editor.org/rfc/rfc9110#name-status-codes)

So, for example, if we receive a well formed request for `/` the status line would be:

```bash
HTTP/1.1 200 OK
```

Where `200` is the status code and `OK` is the optional `reason-phrase`.

We would then add the response headers, starting with `Content-Length: body-size`, a `Content-Type: media-type` (it's not mandatory but if the sender knows the media type, it SHOULD generate the appropriate header) and a `Connection: keep-alive / close` header, depending on how we want to handle the connection.

For now we are going to send back a simple **html** page that we are going to store in memory.

Let's write the server code that reads the request:

```python title="simple_server.py" {27-38} showLineNumbers
import socket

from utils.logger import get_logger

logger = get_logger("server")


def start_server(host: str = "", port: int = 35555):
    """
    Starts a simple TCP socket listening for connection on a port.
    Receives a message and sends it back.
    """

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as my_server:
        my_server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            logger.info("Starting server...")
            my_server.bind((host, port))
            my_server.listen()
            logger.info("Listening on port: %d", port)

            while True:
                conn, addr = my_server.accept()
                with conn:
                    logger.info("Accepted connection from: %s", addr)

                    request = b""
                    while b"\r\n\r\n" not in request:
                        chunk = conn.recv(1024)
                        if not chunk:
                            break
                        request += chunk

                    logger.info("Received: ")
                    print(request.decode("utf-8"))

                    logger.info("Sending to %s:", addr)
                    print(request.decode("utf-8"))

                    conn.sendall(request)
        except KeyboardInterrupt:
            logger.error("Server closed by user.")
        except OSError as e:
            logger.error("Server error: %s", e)


if __name__ == "__main__":
    start_server()
```

If we run the serve and send a request from the client:

```bash
❯ uv run simple_server.py
22-09-2025 22:04:51 - INFO - server - Starting server...
22-09-2025 22:04:51 - INFO - server - Listening on port: 35555
22-09-2025 22:04:56 - INFO - server - Accepted connection from: ('127.0.0.1', 58372)
22-09-2025 22:04:56 - INFO - server - Received:
GET / HTTP/1.1
Host: example.org


22-09-2025 22:04:56 - INFO - server - Sending to ('127.0.0.1', 58372):
GET / HTTP/1.1
Host: example.org
```

We get the request correctly but there are a few problems.
If the request is not valid and it doesn't contain `\r\n\r\n`
both the server and the client are going to get stuck waiting for the other to say something or close the connection.

But we also don't want to get stuck reading a very long message from the client in the hope that we'll get `\r\n\r\n` at some point.

So for our simple server the fix will be to set a `conn.settimeout(5)` so if the server doesn't receive data for 5 seconds it will fail.

We are also going to set a `MAX_HEADER_SIZE` so that if after a certain amount of data we dont get a `\r\n\r\n`, we are going to send either a
`400 Bad Request` or a `413 Content Too Large`.

Our `start_server()` function has already grown too big so we are going to delegate the handling of the connection to another function `handle_conn()`
In case of a correct request we'll send back the correct headers with `Hello, world!` as body.

First a little change to our client:

```python title=simple_client.py {7-9} showLineNumbers
import socket

from utils.logger import get_logger

logger = get_logger("client")

REQUEST_OK = "GET / HTTP/1.1\r\nHost: localhost\r\n\r\n"
REQUEST_TIMEOUT = "GET / HTTP/1.1"
REQUEST_MAX_SIZE = "Hello world" * 1000

[...]

```

And for the server

```python title=simple_server.py {7-19, 22-36, 56-66} showLineNumbers
import socket

from utils.logger import get_logger

logger = get_logger("server")

MAX_HEADER_SIZE = 8192  # 8KB
CONTENT_TOO_LARGE = (
    b"HTTP/1.1 413 Request Header Fields Too Large\r\nConnection: close\r\n\r\n"
)

CONNECTION_TIMEOUT = b"HTTP/1.1 408 Request Timeout\r\nConnection: close\r\n\r\n"
REQUEST_OK = (
    b"HTTP/1.1 200 OK\r\n"
    b"Content-Type: text/plain\r\n"
    b"Content-Length: 12\r\n"
    b"Connection: close\r\n\r\n"
    b"Hello World!"
)


def handle_conn(conn: socket.socket) -> tuple[int, bytes]:
    request = b""
    try:
        while b"\r\n\r\n" not in request:
            chunk = conn.recv(1024)
            if not chunk:
                break
            request += chunk

            if len(request) >= MAX_HEADER_SIZE:
                return (413, CONTENT_TOO_LARGE)

        return (200, request)
    except socket.timeout:
        return (408, CONNECTION_TIMEOUT)


def start_server(host: str = "", port: int = 35555):
    """
    Starts a simple TCP socket listening for connection on a port.
    Receives a message and sends it back.
    """

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as my_server:
        my_server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            logger.info("Starting server...")
            my_server.bind((host, port))
            my_server.listen()
            logger.info("Listening on port: %d", port)

            while True:
                conn, addr = my_server.accept()
                with conn:
                    conn.settimeout(5)
                    logger.info("Accepted connection from: %s", addr)
                    status, request = handle_conn(conn)

                    if status != 200:
                        logger.info("Sending error message %s to: %s", status, addr)
                        conn.sendall(request)
                    else:
                        logger.info("Received request:")
                        print(request.decode("utf-8"))
                        conn.sendall(REQUEST_OK)

        except KeyboardInterrupt:
            logger.error("Server closed by user.")
        except OSError as e:
            logger.error("Server error: %s", e)


if __name__ == "__main__":
    start_server()
```

If we send `REQUEST_TIMEOUT` from the client we get:

```bash
❯ uv run -m simple_server.py
22-09-2025 23:27:29 - INFO - server - Starting server...
22-09-2025 23:27:29 - INFO - server - Listening on port: 35555
22-09-2025 23:27:32 - INFO - server - Accepted connection from: ('127.0.0.1', 32814)
22-09-2025 23:27:37 - INFO - server - Sending error message 408 to: ('127.0.0.1', 32814)
```

```bash
❯ uv run -m simple_client.py
22-09-2025 23:27:32 - INFO - client - Connecting...
22-09-2025 23:27:32 - INFO - client - Connected to server at localhost:35555
22-09-2025 23:27:32 - INFO - client - Sending:
GET / HTTP/1.1
HTTP/1.1 408 Request Timeout
Connection: close
```

For `REQUEST_MAX_SIZE` we get:

```bash
server
22-09-2025 23:29:11 - INFO - server - Accepted connection from: ('127.0.0.1', 43174)
22-09-2025 23:29:11 - INFO - server - Sending error message 413 to: ('127.0.0.1', 43174)
```

```bash
client
HTTP/1.1 413 Request Header Fields Too Large
Connection: close
```

And for a `REQUEST_OK`

```bash
server
22-09-2025 23:36:26 - INFO - server - Received request:
GET / HTTP/1.1
Host: localhost
```

```bash
client
22-09-2025 23:36:26 - INFO - client - Connecting...
22-09-2025 23:36:26 - INFO - client - Connected to server at localhost:35555
22-09-2025 23:36:26 - INFO - client - Sending:
GET / HTTP/1.1
Host: localhost


HTTP/1.1 200 OK
Content-Type: text/plain
Content-Length: 12
Connection: close
Hello World!
```

## Serving pages from disk

Next we are going to send some basic valid **HTML** back to the client instead.
We are going to parse the **GET** request (our server only supports those for now)
and try to serve the requested resource **from disk**, if it doesn't exist we'll serve a **404** page.

I'm going to create a directory called **public/** from which I am going to serve:

```html title="index.html"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Welcome</title>
    <style>
      body {
        font-family: sans-serif;
        text-align: center;
        margin-top: 10%;
        color: #333;
      }
      h1 {
        font-size: 2.5em;
        color: #0066cc;
      }
      p {
        font-size: 1.2em;
      }
      a {
        color: #0066cc;
        text-decoration: none;
      }
      a:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <h1>Hello from Simple Server</h1>
    <p>
      This is the <strong>index.html</strong> page served by your trusted Python
      socket server!
    </p>
  </body>
</html>
```

and:

```html title="404.html"
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>404 Not Found</title>
    <style>
      body {
        font-family: sans-serif;
        text-align: center;
        margin-top: 10%;
        color: #444;
      }
      h1 {
        font-size: 3em;
        color: #c00;
      }
      p {
        font-size: 1.2em;
      }
    </style>
  </head>
  <body>
    <h1>404</h1>
    <p>The page you are looking for could not be found.</p>
    <hr />
    <p><a href="/">Return to homepage</a></p>
  </body>
</html>
```

We are also going to clean our code a little and split the code into multiple functions.
If we plan to add more features we should really start thinking about a proper refactor and especially
to add **proper testing**, but we'll leave that for the next part in this series.

```python title="simple_server.py" {9-24}
import os
import socket

from utils.logger import get_logger

logger = get_logger("server")

MAX_HEADER_SIZE = 8192  # 8KB
PUBLIC_DIR = os.path.abspath("./public")


def safe_join(public_dir: str, req_path: str) -> str | None:
    """
    Safely join paths preventing directory traversal
    """

    path = req_path.lstrip("/")

    full_path = os.path.abspath(os.path.join(public_dir, path))

    if not full_path.startswith(public_dir):
        return None  # invalid path

    return full_path
```

This is a function to safely join `public_dir` with the `resource path` from the request, so that it prevents
directory traversal. The client could send a malicious request that would try to "escape" from the `public` directory and
retrieve something that the client should not have access to. (ie `GET /../../etc/passwd HTTP/1.1`).

```python title="simple_server.py" {} showLineNumbers
def parse_request(request: bytes) -> str | None:
    """
    Extract the path from the HTTP request line.
    """

    try:
        request_line = request.decode("utf-8").split("\r\n")[0]

        method, path, _ = request_line.split()

        if method != "GET":
            return None  # For now we only support GET
        if path == "/":
            path = "/index.html"
        return path

    except (ValueError, IndexError):
        return None
```

This function takes a `GET request` (the only kind of request our server can handle so far)
and extract the path of the resource requested. Simple enough.

```python title="simple_server.py" {} showLineNumbers
def build_response(status_code: int, body: bytes | None = None) -> bytes:
    """Build an HTTP/1.1 response string."""

    reasons = {
        200: "OK",
        400: "Bad Request",
        404: "Not Found",
        408: "Request Timeout",
        431: "Request Header Fields Too Large",
        500: "Internal Server Error",
    }
    reason = reasons.get(status_code, "Unknown")

    # Build headers list
    headers = [f"HTTP/1.1 {status_code} {reason}"]

    if body:
        headers.extend(
            [
                f"Content-Length: {len(body)}",
                "Content-Type: text/html",
            ]
        )
    headers.append("Connection: close")
    logger.info("Returning %d %s response", status_code, reason)

    # Join headers and add body if present
    response = "\r\n".join(headers).encode("utf-8") + b"\r\n\r\n"
    if body:
        return response + body
    return response
```

We pass this function a **status code** and an optional **body** and it will return a properly
formed response that we can send to the client.

But where does the body come from for `/` and the `404 page`?

```python title="simple_server.py" {}
def handle_conn(conn: socket.socket) -> bytes:
    """
    Handles the request and returns an appropriate response.
    """
    logger.info("Handling the connection...")
    request = b""
    try:
        while b"\r\n\r\n" not in request:
            chunk = conn.recv(1024)
            if not chunk:
                break
            request += chunk

            if len(request) >= MAX_HEADER_SIZE:
                return build_response(431)

        logger.info("Received request:")
        print(request.decode("utf-8"))
        path = parse_request(request)

        if not path:
            return build_response(400)

        file_path = safe_join(PUBLIC_DIR, path)

        # if file_path is not a valid file
        # return a 404 response with the content of 404.html as body
        # if it is a valid resource build a 200 OK response
        # with the content of the file as body
        if not file_path or not os.path.isfile(file_path):
            not_found_path = os.path.join(PUBLIC_DIR, "404.html")
            try:
                with open(not_found_path, "rb") as file:
                    body = file.read()
            except FileNotFoundError:
                body = b"<h1>404 Not Found</h1>"
            return build_response(404, body)

        with open(file_path, "rb") as file:
            body = file.read()
        return build_response(200, body)

    except socket.timeout:
        return build_response(408)
    except OSError:
        return build_response(500)

```

We parse the request to get the path of the requested resource, and if the path is valid we get the body from `index.html`,
if the requested resource doesn't exist we use the `404.html` content as body. We also build appropriate responses for all
the other cases (timeout, server error, header content too long).

## Bringing it all home

```python title="simple_server.py"
import os
import socket

from utils.logger import get_logger

logger = get_logger("server")

MAX_HEADER_SIZE = 8192  # 8KB
PUBLIC_DIR = os.path.abspath("./public")


def safe_join(public_dir: str, req_path: str) -> str | None:
    """
    Safely join paths preventing directory traversal
    """

    path = req_path.lstrip("/")

    full_path = os.path.abspath(os.path.join(public_dir, path))

    if not full_path.startswith(public_dir):
        return None  # invalide path

    return full_path


def parse_request(request: bytes) -> str | None:
    """
    Extract the path from the HTTP request line.
    """

    try:
        request_line = request.decode("utf-8").split("\r\n")[0]

        method, path, _ = request_line.split()

        if method != "GET":
            return None  # For now we only support GET
        if path == "/":
            path = "/index.html"
        return path

    except (ValueError, IndexError):
        return None


def build_response(status_code: int, body: bytes | None = None) -> bytes:
    """Build an HTTP/1.1 response string."""

    reasons = {
        200: "OK",
        400: "Bad Request",
        404: "Not Found",
        408: "Request Timeout",
        431: "Request Header Fields Too Large",
        500: "Internal Server Error",
    }
    reason = reasons.get(status_code, "Unknown")

    # Build headers list
    headers = [f"HTTP/1.1 {status_code} {reason}"]

    if body:
        headers.extend(
            [
                f"Content-Length: {len(body)}",
                "Content-Type: text/html",
            ]
        )
    headers.append("Connection: close")
    logger.info("Returning %d %s response", status_code, reason)

    # Join headers and add body if present
    response = "\r\n".join(headers).encode("utf-8") + b"\r\n\r\n"
    if body:
        return response + body
    return response


def handle_conn(conn: socket.socket) -> bytes:
    """
    Handles the request and returns an appropriate response.
    """
    logger.info("Handling the connection...")
    request = b""
    try:
        while b"\r\n\r\n" not in request:
            chunk = conn.recv(1024)
            if not chunk:
                break
            request += chunk

            if len(request) >= MAX_HEADER_SIZE:
                return build_response(431)

        logger.info("Received request:")
        print(request.decode("utf-8"))
        path = parse_request(request)

        if not path:
            return build_response(400)

        file_path = safe_join(PUBLIC_DIR, path)

        # if file_path is not a valid file
        # return a 400 response with the content of 404.html as body
        # if it is a valid resource build a 200 OK response
        # with the content of the file as body
        if not file_path or not os.path.isfile(file_path):
            not_found_path = os.path.join(PUBLIC_DIR, "404.html")
            try:
                with open(not_found_path, "rb") as file:
                    body = file.read()
            except FileNotFoundError:
                body = b"<h1>404 Not Found</h1>"
            return build_response(404, body)

        with open(file_path, "rb") as file:
            body = file.read()
        return build_response(200, body)

    except socket.timeout:
        return build_response(408)
    except OSError:
def start_server(host: str = "", port: int = 35555):
    """
    Starts a simple HTTP server that serves files from a public directory.
    """

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as my_server:
        my_server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            logger.info("Starting server...")
            my_server.bind((host, port))
            my_server.listen()
            logger.info("Listening on port: %d", port)

            while True:
                conn, addr = my_server.accept()
                with conn:
                    conn.settimeout(5)
                    logger.info("Accepted connection from: %s", addr)
                    response = handle_conn(conn)

                    conn.sendall(response)

        except KeyboardInterrupt:
            logger.error("Server closed by user.")
        except OSError as e:
            logger.error("Server error: %s", e)


if __name__ == "__main__":
    start_server()
```

```python title="simple_client.py" {8}
import socket

from utils.logger import get_logger

logger = get_logger("client")

REQUEST_OK = "GET / HTTP/1.1\r\nHost: localhost\r\n\r\n"
REQUEST_404 = "GET /not_existant HTTP/1.1\r\nHost: localhost\r\n\r\n"
REQUEST_TIMEOUT = "GET / HTTP/1.1"
REQUEST_MAX_SIZE = "Hello world" * 1000


def start_client(
    host: str = "localhost", port: int = 35555, message: str = "Hello, world!"
):
    """
    Create a simple socket client that sends a
    GET request to a web server message to a server
    and reads the response.
    """

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as client:
        try:
            logger.info("Connecting...")
            client.connect((host, port))
            logger.info("Connected to server at %s:%d", host, port)

            logger.info("Sending:")
            print(message)
            client.sendall(message.encode("utf-8"))

            buffer = b""
            while b"\r\n\r\n" not in buffer:
                chunk = client.recv(1024)
                buffer += chunk

            headers, body = buffer.split(b"\r\n\r\n", 1)
            headers = headers.decode("utf-8").split("\r\n")

            body_length: int = 0
            for h in headers:
                if h.lower().startswith("content-length:"):
                    body_length = int(h.split(":", 1)[1].strip())
                print(h)

            while len(body) < body_length:
                chunk = client.recv(1024)
                body += chunk

            print(body.decode("utf-8"))
        except ConnectionRefusedError:
            logger.error("Connection refused. Make sure the server is running.")
        except OSError as e:
            logger.error("Client error: %s", e)


if __name__ == "__main__":
    start_client(message=REQUEST_404)
```

You can even run the server and connect from your browser:

```bash
❯ uv run -m simple_server.py
23-09-2025 23:01:33 - INFO - server - Starting server...
23-09-2025 23:01:33 - INFO - server - Listening on port: 35555
23-09-2025 23:01:47 - INFO - server - Accepted connection from: ('127.0.0.1', 35676)
23-09-2025 23:01:47 - INFO - server - Handling the connection...
23-09-2025 23:01:47 - INFO - server - Received request:
GET / HTTP/1.1
Host: localhost:35555
User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate, br, zstd
Connection: keep-alive
Upgrade-Insecure-Requests: 1
Sec-Fetch-Dest: document
Sec-Fetch-Mode: navigate
Sec-Fetch-Site: none
Sec-Fetch-User: ?1
Priority: u=0, i


23-09-2025 23:01:47 - INFO - server - Returning 200 OK response
```

![index.html](@/assets/images/sockets2_index.png)

And if Firefox requests a non-existing page:

```bash
23-09-2025 23:12:29 - INFO - server - Accepted connection from: ('127.0.0.1', 38780)
23-09-2025 23:12:29 - INFO - server - Handling the connection...
23-09-2025 23:12:29 - INFO - server - Received request:
GET /nonexisting HTTP/1.1
Host: localhost:35555
User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate, br, zstd
Connection: keep-alive
Upgrade-Insecure-Requests: 1
Sec-Fetch-Dest: document
Sec-Fetch-Mode: navigate
Sec-Fetch-Site: none
Sec-Fetch-User: ?1
Priority: u=0, i


23-09-2025 23:12:29 - INFO - server - Returning 404 Not Found response
```

![404.html](@/assets/images/sockets2_404.png)

The `Return to homepage` link works too.

Sure our code could use a good refactor, to be made more Pythonic and especially
some **proper testing**, but we have come quite a long way.

## Conclusion

We started from basic sockets and we ended up having a very primitive but "working"
`HTTP server/client` implementation.

In the next part we will refactor our code and focus on giving our server the ability to serve multiple clients at the same time. Very exciting!

I hope you enjoyed our journey so far. Don't forget to play around with the code,
maybe break it a little (or a lot), and especially, have some fun!

