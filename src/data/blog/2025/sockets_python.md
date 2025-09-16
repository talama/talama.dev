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

How do we ask the OS for a socket? We call

```python
class socket.socket(family=AF_INET, type=SOCK_STREAM, proto=0, fileno=None)
```

to create a socket object. The parameters are:

- `family`: The address family. Defaults to **AF_INET** (IPv4). Other valid values are **AF_UNIX** and **AF_INET6** (IPv6)
- `type`: The *style* of communication. Defaults to **SOCK_STREAM** (connection-oriented, reliable, sequenced byte stream, usually TCP).
  Other valid values are **SOCK_DGRAM** (datagram-based, unreliable, unordered messages, usually UDP), **SOCKET_RAW** (raw sockets, we bypass most of the OS's protocol handling and talk almost directly to the network layer so that we can construct our own IP/ICMP/TCP/UDP headers).
- `proto`: protocol number. The default value 0 means that the combination of **address family** and **type** will determine the protocol and we don't need to specify one. (So for example if we have **AF_INET** and **SOCK_STREAM** as family/type with `proto=0` **TCP** will be used )
- `fileno` (lets us use a file descriptor representing a socket that we got from somewhere else, and wrap it in a python socket object. The default value `None` tells Python to create a brand new socket object)

Here is an example that creates a socket that uses IPv4 at the network layer and TCP at the transport layer:

```python
import socket

server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
```

