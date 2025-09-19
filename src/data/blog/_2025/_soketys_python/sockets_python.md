---
title: Understanding sockets with Python
author: Luca Salomoni
date: 2025-09-13T19:00:25.283Z
featured: true
draft: false
categories:
  - Networking
tags:
  - Sockets
  - Python
description: Learning about sockets by programming simple client/server code with Python
---
In this post we will look at what sockets are and how we can use them to communicate over the internet
by writing some simple client/server code in Python.

## Table of contents

## Sockets, a definition and a little bit of history

So, first of all, what is a socket? Soket are a form of IPC (inter process communication) that gives processes
a way to communicate with each other.
They are not the only form of IPC but they are the most popular especially for **cross platform** communication.

The socket API allows a variety of method of communication between processes
and one of these methods is through the internet, which is what we are going to focus on in this post.

The idea of sockets comes from the early days of UNIX in the 1980s, when the BSD (Berkeley Software Distribution)
operating system introduced the Berkeley sockets API.
This API became the foundation for network programming
and remains the model used by modern languages—including Python today.

In Python, the Python sockets API is a library that calls the lower-level C sockets API.
At least on Unixlikes. On other platforms, it will call whatever API that OS exposes for network communication.

## The Python socket API

The Python [socket module](https://docs.python.org/3/library/socket.html) provides access to the BSD socket interface.
This is the module we'll focus on in this post, but it's not the only one that allows us to leverage sockets
to build client/server communication.

The [socketserver](https://docs.python.org/3/library/socketserver.html) module builds on top of `socket`
to simplify the task of writing network servers.
It also provides classes for creating threaded or forked versions of TCP/UDP services.

The [asyncio](https://docs.python.org/3/library/asyncio.html) module is a library for writing
concurrent code using the **async/await** syntax and serves as a foundation
for many Python asynchronous frameworks that power high-performance network and web servers.

At the end of this post, we’ll look at simple examples of both `socketserver` and `asyncio`
(with a special focus on `asyncio`).

While there are real-world scenarios where you'd choose the lower level `socket` API
over higher level abstractions
--low level protocols, working with raw sockets for packet sniffers and protocol analyzers--
the main reason we are using it here is educational.
Looking "under the hood" and building "a toy version" of something is
the best way to truly understand a concept, and it also makes the higher-level abstractions much clearer.

Also... it's a lot fun!

## A little logger

This is a tiny little logger. There are many like it, but this one is mine.
I've used it in most of my tests/toy projects for a while and I've grown to prefer it to console logging/printing,
even for tiny tests.

```python
// utils/logger.py
import logging

def get_logger(name: str = __name__) -> logging.Logger:
    """Create a custom logger by name"""
    logger = logging.getLogger(name)
    logger.setLevel(logging.INFO)

    # Avoid adding multiple handlers if logger is requested multiple times
    if not logger.handlers:
        console_handler = logging.StreamHandler()
        console_formatter = logging.Formatter(
            "%(asctime)s - %(levelname)s - %(name)s - %(message)s",
            style="%",
            datefmt="%d-%m-%Y %H:%M:%S",
        )
        console_handler.setFormatter(console_formatter)
        logger.addHandler(console_handler)

    return logger
```

I would normally drop it in a folder named `utils` and import it with:

```python
from utils.logger import get_logger
```

And now that we've got this out of the way let's move on to implement...

## The Server

But what does a server do? What even **is** a server and how can we use sockets to create one?

At its core, a `server` is just a device or a process that provides various functionality --often called `services`--
to other devices or processes called `clients`, over a network. This model is called the **client--server** architecture.

This architecture is most frequently implemented as the `request-response` model:

- The server waits for an incoming connection on a specific network address (an IP + port).
- A client connects to that address and send a request.
- The server processes the request and sends back a response.

With this idea in mind we're going to create a program that will:

1. **Ask the OS for a socket**. In python a socket is an object whose methods implement the various system calls provided by the C API.
2. **Bind that socket to a port**.
3. **Listen for incoming connections**. Our socket will let the OS know when a new request arrives on the port it’s bound to.
4. **Accept the incoming connection**. Accepting a connection will create a new socket specifically for **this** client connection.
   This way the server can handle multiple clients, one per socket, while the “original” socket keeps listening for new connections.
5. **Send and receive data**. The server will handle client requests and respond to them. (In our example we will just process ONE request per client at first).
6. **Handle the end of the connection**.
   When the client connection closes, the server moves on to the next accepted connection (if any), or goes back to listening on the bound port.

Now that everythin is, hopefully clear, lets start writing some code!

### Creating a socket object

How do we ask the OS for a socket? We call

```python
class socket.socket(family=AF_INET, type=SOCK_STREAM, proto=0, fileno=None)
```

to create a socket object. The parameters are:

- `family`: The address family. Defaults to **AF_INET** (IPv4). Other valid values are **AF_UNIX** and **AF_INET6** (IPv6)
- `type`: The *style* of communication. Defaults to **SOCK_STREAM** (connection-oriented, reliable, sequenced byte stream, usually TCP).
  Other valid values are **SOCK_DGRAM** (datagram-based, unreliable, unordered messages, usually UDP), **SOCK_RAW** (raw sockets, we bypass most of the OS's protocol handling and talk almost directly to the network layer so that we can construct our own IP/ICMP/TCP/UDP headers).
- `proto`: protocol number. The default value 0 means that the combination of **address family** and **type** will determine the protocol and we don't need to specify one. (So for example if we have **AF_INET** and **SOCK_STREAM** as family/type with `proto=0` **TCP** will be used )
- `fileno` (lets us use a file descriptor representing a socket that we got from somewhere else, and wrap it in a python socket object. The default value `None` tells Python to create a brand new socket object)

Here is an example that creates a socket that uses IPv4 at the network layer and TCP at the transport layer:

```python
import socket

my_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
```

### Setting sockets options

Once we have our socket we can set some options on it if we want to, calling the socket object method:

```python
socket.setsockopt(level, optname, value: int)

```

Where `level` is what protocol layer we want to set the option for, `optname` is the name of the option and `value` is... the value of the option (usually either **0** or **1**).

So for example usually there is a `TIME_WAIT` (which can last even a couple of minutes) after a socket closes before you can rebind another socket to the same address/port.
We can set an option of `SOL_SOCKET` level (meaning that it's an option we can apply to all types of sockets), named `SO_REUSEADDR` to **1** to allow our program to rebind the server to the same address/port regardless of `TIME_WAIT`

```python
my_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
```

Other options are specific to some socket type:

```python
my_socket.setsockopt(socket.IPPROTO_IP, socket.IP_TTL, 64)
```

In this example we set an option of level `IPPROTO_IP` (applies to IPv4 sockets), named `IP_TTL` that sets the **time to live** for IPv4 packets to 64.

### Bind, Listen, Accept

Once we have our socket object and we have set some options it's time to bind the socket to an address.
An address in this context is a 2-tuple **(host, port)**. If the host is an empty string **""** or **0.0.0.0** our socket will be bound to all available interfaces on the machine it's running on. For our examples we will use **127.0.0.1** so that our server will be only listening on the loopback interface.

Then we can tell our socket to start listening for incoming connection requests with:

```python
socket.listen([backlog])
```

where `backlog` is the number of yet **unaccepted** connections that the system will allow before refusing new connections requests. If `backlog` is not specified a reasonable default value is chosen.
By default a socket listening for connections will accept and process **one** connection at a time (unless of course we add concurrency --and we will later-- using `threads`, `select` or `asyncio`), and once that connection is closed it will **accept** and process the next one in the "backlog".

When a connection is accepted with:

```python
new_socket, addr = socket.accept()
```

a **new socket** object is returned in a tuple with the **addr** of the client whose connection was accepted.
This way the "original" socket can keep listening for incoming connections, while the new socket can process client requests.

### Bringing it (almost) all together

Lets take what we have so far, sprinkle some logging and some light exception handling on top and write a simple server

```python
// file: simple_server.py
import socket

from utils.logger import get_logger

logger = get_logger("server")


def start_server(host: str = "", port: int = 35555):
    """
    Starts a simple IPv4/TCP socket listening for connections on a port.
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
                # conn is the new socket created by accepting
                # the client request.
                # addr is the client (host, port) address
                conn, addr = my_server.accept()
                with conn:
                    logger.info("Accepted connection from: %s", addr)

                # TODO

        except KeyboardInterrupt:
            logger.info("Server closed by user.")
        except socket.error as e:
            logger.error("Server error: %s", e)


if __name__ == "__main__":
    start_server()
```

The **while True:** is there to ensure we keep accepting new connections as they are available,
otherwise our server would close after accepting the first one.

Once we run our script we get:

```bash
17-09-2025 11:42:00 - INFO - server - Starting server...
17-09-2025 11:42:00 - INFO - server - Listening on port: 35555
```

The choice of port is completely up to you, just remember that ports 1/1023 are well-known ports and require root/administrator privileges to be bound, and maybe avoid ports that are known to be used by other services that might be running on your machine.

While the server is running you can open another terminal and try to connect to it:

```bash
❯ telnet 127.0.0.1 35555
Trying 127.0.0.1...
Connected to 127.0.0.1.
Escape character is '^]'.
Connection closed by foreign host.
```

And on the terminal where the server is running you will see the line:

```bash
17-09-2025 11:42:04 - INFO - server - Accepted connection from: ('127.0.0.1', 44476)
```

The client connection with telnet will immediately close, since right now our server isn't doing anything with the client request --we are going to fix this soon enough--

Notice also how the client address is also identified by an **(host, port)** tuple. The OS assigns a free port to the client if one is not specified. If you connect multiple times to the server, you will notice the client port changes every time.

```bash
❯ uv run simple_server.py
17-09-2025 11:49:07 - INFO - server - Starting server...
17-09-2025 11:49:07 - INFO - server - Listening on port: 35555
17-09-2025 11:49:10 - INFO - server - Accepted connection from: ('127.0.0.1', 33542)
17-09-2025 11:49:12 - INFO - server - Accepted connection from: ('127.0.0.1', 33550)
17-09-2025 11:49:13 - INFO - server - Accepted connection from: ('127.0.0.1', 49536)
17-09-2025 11:49:14 - INFO - server - Accepted connection from: ('127.0.0.1', 49542)
17-09-2025 11:49:14 - INFO - server - Accepted connection from: ('127.0.0.1', 49544)
```

### recv() and send()

Let's finally get our server to do something, albeit something very simple.

Before we can respond to the client we should read the request they sent. We can do this with:

```python
data = socket.recv(bufsize)
```

`bufsize` is the maximum amount of data to be received at once.

When `recv()` returns **0 bytes** it means the other side has closed the connection.
That doesn't mean that, for example `data = recv(1024)` will receive **1024** bytes each time.

Partial reads are normal because a message can arrive in chunks that can be either **bigger** or **smaller** than `bufsize`.
It's up to you to make sure to keep calling `recv()` until the message from the server has been dealt with.

`recv()` is also **blocking** meaning that, on one side it will wait until *at least one byte is available*
and on the other side it will keep receiving until the connection is broken.

This means that when a client connection is accepted, `recv()` will wait potentially "forever" until the first byte is sent from the client.

Lets verify that now by filling the while loop in our server:

```python {27-29}
// file: simple_server.py
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
                    data: bytes = conn.recv(1024)
                    if not data: break
                    logger.info("Received: %s", data.decode("utf-8"))
       except KeyboardInterrupt:
            logger.info("Server closed by user.")
        except socket.error as e:
            logger.error("Server error: %s", e)


if __name__ == "__main__":
    start_server()
```

If we start our server now, and try to connect with telnet

```bash
❯ uv run simple_server.py
17-09-2025 16:41:06 - INFO - server - Starting server...
17-09-2025 16:41:06 - INFO - server - Listening on port: 35555
```

```bash
❯ telnet 127.0.0.1 35555
Trying 127.0.0.1...
Connected to 127.0.0.1.
Escape character is '^]'.

```

```bash {4}
❯ uv run simple_server.py
17-09-2025 16:41:06 - INFO - server - Starting server...
17-09-2025 16:41:06 - INFO - server - Listening on port: 35555
17-09-2025 16:41:09 - INFO - server - Accepted connection from: ('127.0.0.1', 52264)
```

You'll see that not only telnet will not immediately disconnect,
but the server will keep the connection open until it receives at least *one byte* from the client.

If we send a message:

```bash {5-6}
❯ telnet 127.0.0.1 35555
Trying 127.0.0.1...
Connected to 127.0.0.1.
Escape character is '^]'.
Ciao!
Connection closed by foreign host.
```

```bash {5}
❯ uv run simple_server.py
17-09-2025 16:41:06 - INFO - server - Starting server...
17-09-2025 16:41:06 - INFO - server - Listening on port: 35555
17-09-2025 16:41:09 - INFO - server - Accepted connection from: ('127.0.0.1', 52264)
17-09-2025 16:41:14 - INFO - server - Received: Ciao!
```

The client will send the message **"Ciao!"** to the server,
the server will `recv()` the message and then close the connection to the client.

It's really worth noting that a `bufsize` of **1024**, while quite common, is also completely arbitrary, and that **you** are responsible for
implementing the logic for properly receiving the client message.

The reason is that the **socket API** gives you the tools to create a connection between the client and the server, and to transmit and receive the data along that connection.
What the data means, and how it should be interpreted by the client and server is up to you to decide. In other words you have to implement your own **protocol** or use an existing one.

Think of the **socket API** as the tool that allows you to build the telegraph line, but you still need to use the morse code to communicate, or invent your own communication code.

As last "improvement" for our server we will echo back to the client the data we received:

```python
// file: simple_server.py
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
                    data: bytes = conn.recv(1024)
                    if not data: break
                    logger.info("Received: %s", data.decode("utf-8"))

                    logger.info("Sending to %s: %s", addr, data.decode("utf-8"))
                    conn.sendall(data)
        except KeyboardInterrupt:
            logger.info("Server closed by user.")
        except socket.error as e:
            logger.error("Server error: %s", e)
```

`scoket.send(bytes)` takes a **byte-like object** as input and attempts to transmit as much of that data as possible in one system call and returns the number of bytes sent.
You can clearly see the parallel with `socket.recv(bufsize)`, but since the sender knows the size of the message (unlike the receiver),
a `sendall()` method exist that will call `send()` untill the entire buffer is transmitted (or an error occurs).

So now finally if we start our server and send a message with telnet:

```bash
❯ uv run simple_server.py
17-09-2025 17:55:10 - INFO - server - Starting server...
17-09-2025 17:55:10 - INFO - server - Listening on port: 35555
```

```bash
❯ telnet 127.0.0.1 35555
Trying 127.0.0.1...
Connected to 127.0.0.1.
Escape character is '^]'.
```

```bash {3}
17-09-2025 17:55:10 - INFO - server - Starting server...
17-09-2025 17:55:10 - INFO - server - Listening on port: 35555
17-09-2025 17:55:14 - INFO - server - Accepted connection from: ('127.0.0.1', 45534)
```

```bash {5}
❯ telnet 127.0.0.1 35555
Trying 127.0.0.1...
Connected to 127.0.0.1.
Escape character is '^]'.
Ciao!
```

```bash {4, 6}
17-09-2025 17:55:10 - INFO - server - Starting server...
17-09-2025 17:55:10 - INFO - server - Listening on port: 35555
17-09-2025 17:55:14 - INFO - server - Accepted connection from: ('127.0.0.1', 45534)
17-09-2025 17:55:18 - INFO - server - Received: Ciao!

17-09-2025 17:59:21 - INFO - server - Sending to ('127.0.0.1', 44810): Ciao!
```

```bash {6-7}
❯ telnet 127.0.0.1 35555
Trying 127.0.0.1...
Connected to 127.0.0.1.
Escape character is '^]'.
Ciao!
Ciao!
Connection closed by foreign host.
```

The server echoes back the data it received and then closes the connection, the client receives the server response and then quits.

But what fun is it to use telnet? Time to use what we learned to write...

## The Client

We covered quite a bit of ground on the **socket API** so now writing a simple client should prove to be easy.

But what does the client do? It:

- **Ask the OS for a socket that matches the server's**
- **Connect to the server socket**
- **Send and receive data**
- **Close the connection**

In our case we know that the server address will be **(127.0.0.1, 35555)**,
but if we'd use an **hostnanme**, `socket.connect((hostname, port))` would perform a **DNS lookup** for us.

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
        print(f"Canoname: {canonname if canonname else '-'}")
        print("-" * 40)
```

when run will give you:

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
        except socket.error as e:
            logger.error("Client error: %s", e)


if __name__ == "__main__":
    start_client(message="This is a test message from the client.")
```

We create a scoket with the same `socket family` (**AF_INET**) and the same `socket type` (**SOCK_STREAM**) as the server,
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
They then procede to **send/recv** data. Making sense of what the data means, and how to process it, is up the developer (you).

## (Miss)Communication Breakdown

To show you why `protocols` (rules that establish how the communication should happen) are so important, and also to show you how the socket API only cares about connecting compatible end points, we can do a little experiment.

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

But then we send a message that the server doesn't know how to interpret so it answers with a bad request.

Some servers will answer differently, but most of the times you will either get a `400 Bad Request`,
or your client will hang untill it gets `408 Request Timeout` from the server.

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

So what if we thought the client to speak HTTP, even just a little?

## The client learns some HTTP

But how does someone learn HTTP?

![one actually does](@/assets/images/onedoesnot.jpg)

Currently HTTP/1.1 is defined by:

- [RFC 9112 - HTTP/1.1](https://www.rfc-editor.org/rfc/rfc9112.html)
- [RFC 9110 - HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
- [RFC 9111 - HTTP Caching](https://www.rfc-editor.org/rfc/rfc9110.html)

Not the easiest read, but very interesting. Fortunately we only need **very** small subset of the
information contained there (at least for now). And we are not going to reference the caching RFC at all.

The syntax of the messages is defined in **RFC 9112**, while the **semantics of methods, status codes, and header files**
are defined separately in **RFC 9110**.

At its simplest, a request has this structure ( [RFC 9112, Section 2.1](https://www.rfc-editor.org/rfc/rfc9112.html#name-message-format) ):

```bash
  HTTP-message   = start-line CRLF
                   *( field-line CRLF )
                   CRLF
                   [ message-body ]
```

where `start-line` can be either a `request-line` or a `status-line` depending if this is a request or a response,
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
    Create a simple socket client that sends a message to a server and receives a message back.
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
        except socket.error as e:
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

Success!! (kinda).

We received a meaningful response because we made meaningful request.
Too bad we only got the first **1024** bytes of it...

How do we read the full response? Well we sent `Connection: close` as header in our request,
so we know the server is going to send a response and then close the connection.
So we can simply just read **chunks** of **bufsize** until the server closes the connection and
sends **0 bytes** (`b""`).

Its not perfect, but it works in this case and its easy to implement:

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
    Create a simple socket client that sends a message to a server and receives a message back.
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
        except socket.error as e:
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
/
But... What if we didn't send the `Connection: close` header, and we wanted to read multiple responses?

Notice also that, with our current code, if we remove the `Connection: close` header, our `While: True` never ends:

```python {3-5}
            res = b""
            while True:
                chunk = client.recv(1024)
                if not chunk:
                    break
                res += chunk

```

Remember that `recv()` **is blocking** meaning it will sit there waiting for the server to say something.
The loop only breaks when the servers closes the connection and send **0 bytes** (an empty `b""`), so
it would potentially never end.

In the case of `example.org` the loop will eventually end when the server times out and closes the connection, the client
will then print the response and close.

## It's all in your Head(ers)

