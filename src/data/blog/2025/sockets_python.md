---
title: Understanding sockets with Python
author: Luca Salomoni
date: 2025-09-13T19:00:25.283Z
featured: true
draft: false
tags:
  - Sockets
  - Networking
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

The [socketserver](https://docs.python.org/3/library/socketserver.html) module builds on top `socket`
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

