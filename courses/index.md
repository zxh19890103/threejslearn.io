---
layout: default
title: THREEJS Courses
---

{% for part in site.data.courseoutline.course.parts %}

  <h2>{{ part.title }}?</h2>

  <ul>
    {% for chapter in part.chapters %}
    <li>
    <a href="/courses/{{part.level}}/{{ chapter.filename }}">{{ chapter.title }}</a>
    </li>
    {% endfor %}
  </ul>

{% endfor %}
