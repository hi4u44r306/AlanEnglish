import React, { useState, useEffect } from 'react';
import firebase from 'firebase';
import Music from './testMusic';
import '../assets/scss/Addmusic.scss';

export default function TodoList() {
  const [todoList, setTodoList] = useState();

  useEffect(() => {
    const todoRef = firebase.database().ref('User').child('Music');
    todoRef.on('value', (snapshot) => {
      const todos = snapshot.val();
      const todoList = [];
      for (let id in todos) {
        todoList.push({ id, ...todos[id] });
      }
      setTodoList(todoList);
    });
  }, []);

  return (
    <div className='addmusiclist'>
      {todoList
        ? todoList.map((todo, index) => <Music todo={todo} key={index} />)
        : ''}
    </div>
  );
}
