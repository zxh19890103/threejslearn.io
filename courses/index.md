---
layout: default
title: THREEJS Courses
---

{% for part in site.data.courseoutline.course.parts %}
  <h2 class="BookPartTitle">{{ part.title }}</h2>

  <ul class="BookChapters">
    {% for chapter in part.chapters %}
    <li class="BookProgress-{{ chapter.progress | default: 'todo' }}">
      <a href="/courses/{{part.level}}/{{ chapter.filename }}">{{ chapter.title }}</a>
    </li>
    {% endfor %}
  </ul>

{% endfor %}
