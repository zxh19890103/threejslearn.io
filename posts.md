---
layout: default
title: Posts
---

{% for post in site.posts %}

  <article>
    <h2><a href="{{ post.url }}">{{ post.title }}</a></h2>
    <p><time datetime="{{ post.date | date_to_xmlschema }}">{{ post.date | date: "%B %d, %Y" }}</time></p>
    <p>{{ post.excerpt }}</p>
    <a href="{{ post.url }}">Read more</a>
  </article>

{% endfor %}
