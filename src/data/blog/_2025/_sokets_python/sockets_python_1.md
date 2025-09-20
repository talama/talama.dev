---
title: Understanding sockets with Python - Part 1
author: Luca Salomoni
date: 2025-09-20T19:00:25.283Z
featured: true
draft: false
categories:
  - Networking
tags:
  - Sockets
  - Python
description: >-
  In Part 1 we look at the basics of sockets by writing some simple server code.
  At the end we will have a server that we can telnet to, and that will echo our
  messages.
---
This is the first part in a series of posts where we'll explore what sockets are
and how we can use them to communicate over a network, by writing some simple client/server code in Python.

At the end of this post we will have a server that we can telnet to, and that will echo our messages.

## Table of contents

## Sockets, a definition and a little bit of history

So, first of all, what is a socket? Sockets are a form of IPC (inter process communication) that gives processes
a way to communicate with each other.
They are not the only form of IPC but they are the most popular especially for **cross platform** communication.

The socket API allows a variety of method of communication between processes.
One of these methods is through the internet, which is our focus in this post.

The idea of sockets comes from the early days of UNIX in the 1980s, when the BSD (Berkeley Software Distribution)
operating system introduced the Berkeley sockets API.
This API became the foundation for network programming
and remains the model used by modern languages—including Python today.

In Python, the Python sockets API is a library that calls the lower-level C sockets API.
At least on Unixlikes systems. On other platforms, it will call whatever API that OS exposes for network communication.

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

While there are real-world scenarios for choosing the lower-level `socket` API
over higher level abstractions
(eg., for low level protocols or working with raw sockets for packet sniffers and protocol analyzers),
the main reason we are using it here is educational.

Looking "under the hood" and building "a toy version" of something is
the best way to truly understand a concept, and it also makes the higher-level abstractions much clearer.

Also... it's a lot of fun!

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

Now that everything is hopefully clear, let's start writing some code!

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
- `fileno`: lets us use a file descriptor representing a socket that we got from another source, and wrap it in a Python socket object. The default value `None` tells Python to create a brand new socket object.

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

By default a socket listening for connections will accept and process **one** connection at a time (unless of course we add concurrency using for example `threads`, `select` or `asyncio`), but it will also mantain a queue of pending connections. The backlog parameter specifies the maximum size of this queue. When a client attempts to
connect, if the queue is full, the connection may be refused.

After a connection is closed, the server will accept the next one from the queue.

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
        except OSError as e:
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
It's up to you to make sure to repeatedly call `recv()` until the entire message from the client has been received.

`recv()` is also **blocking** meaning that, on one side it will wait until *at least one byte is available*
and on the other side it will keep receiving until the connection is broken.

This means that when a client connection is accepted, `recv()` will wait potentially "forever" until the first byte is sent from the client.

Let's verify that now by filling in the while loop in our server:

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
                    if not data:
                        break
                    logger.info("Received: %s", data.decode("utf-8"))
       except KeyboardInterrupt:
            logger.info("Server closed by user.")
        except OSError as e:
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

It's really worth noting that a `bufsize` of **1024**, while quite common, is also completely arbitrary, and that we are only calling `recv()` once,
receiving only at most **1024** bytes of data.

**You** are responsible for implementing the logic for properly receiving the client message.
In the next part of this series we will look on how we can accomplish that.

The reason is that the **socket API** gives you the tools to create a connection between the client and the server, and to transmit and receive the data along that connection.
What the data means, and how it should be interpreted by the client and server is up to you to decide. In other words you have to implement your own **protocol** or use an existing one.

Think of the **socket API** as the tool that allows you to build the telegraph line, but you still need to use the morse code to communicate, or invent your own communication code.

As a final "improvement" for our server, we will echo back to the client the data we received:

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
                    if not data:
                        break
                    logger.info("Received: %s", data.decode("utf-8"))
                    logger.info("Sending to %s: %s", addr, data.decode("utf-8"))
                    conn.sendall(data)
        except KeyboardInterrupt:
            logger.info("Server closed by user.")
        except OSError as e:
            logger.error("Server error: %s", e)

if __name__ == "__main__":
    start_server()
```

`socket.send(bytes)` takes a **byte-like object** as input and attempts to transmit as much of that data as possible in one system call and returns the number of bytes sent.
You can clearly see the parallel with `socket.recv(bufsize)`, but since the sender knows the size of the message (unlike the receiver),
a `sendall()` method exists that will call `send()` repeatedly until the entire buffer is transmitted (or an error occurs).

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
We can call that a resounding success for now!

But what fun is it to use telnet? Wouldn't it be much better if we could write our own client?
This is exactly what we are going to do in the [next part](sockets_python_2)!

## Conclusions

We covered quite a bit of ground in this first part, but there is so much more to explore.
We've looked at what sockets are and how we can use the socket module in Python to create communication channels over a network.
Don't forget to play around with our code, make it better, break it and, most importantly... have fun!

