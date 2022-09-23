import React, { useState } from 'react';
import firebase from '../Pages/firebase'


export default function Form() {
  const [bookname, setBookname] = useState('');
  const [page, setPage] = useState('');
  const [lang, setLang] = useState('');
  const [type, setType] = useState('');


  const handlebookname = (e) => {
    setBookname(e.target.value);
  };
  const handlepage = (e) => {
    setPage(e.target.value);
  };
  const handleImage = (e) => {
    const file = e.target.files[0]
    const storageRef = firebase.target.storage
    const filRef = storageRef.chile(file.name)
    filRef.put(file).then(() => {
      console.log("Upload file", file.name);
    })
  };
  const handlelang = (e) => {
    setLang(e.target.value);
  };

  const handletype = (e) => {
    setType(e.target.value);
  };

  const createRealtimeUsers = () => {
    createUser();
    createMusicinUser();
  }

  const createUser = () => {
    const UserRef = firebase.database().ref('Users').child('User').child('UserID');
    const user = {
      realtimeuid: "YY6Muy2CwtYqs9JO3jA4XrxGzk43",
    };
    UserRef.push(user);
  }


  const createMusicinUser = () => {
    const todoRef = firebase.database().ref('Users').child('User').child('Musics').child('EachMusic');
    const todo = {
      bookname : bookname,
      page : "P."+page,
      lang,
      timesplayed: "0",
      type,
      complete: false,
      count : 1,
    };

    todoRef.push(todo);
  };
  return (
    <div>
      <div className="add">
        <label>Bookname</label>
        {/* <input type="text" onChange={handlebookname} value={bookname} /> */}
        <select onChange={handlebookname} value={bookname}>
          <option value="">Select Bookname</option>
          <option value="Book1">Book1</option>
          <option value="Book2">Book2</option>
          <option value="Book3">Book3</option>
          <option value="Book4">Book4</option>
          <option value="Book5">Book5</option>
          <option value="Book6">Book6</option>
        </select>
      </div>
      <div className="add">
        <label>Page</label>
        <input type="text" onChange={handlepage} value={page} />
      </div>
      <div className="add">
        <label>Image</label>
        <input type="file" onChange={handleImage}/>
        {/* <input type="text" onChange={handleimage} value={image} /> */}
      </div>
      <div className="add">
        <label>Lang</label>
        <select onChange={handlelang} value={lang}>
          <option value="">Select Lang</option>
          <option value="Book1">Book1</option>
          <option value="Book2">Book2</option>
          <option value="Book3">Book3</option>
          <option value="Book4">Book4</option>
          <option value="Book5">Book5</option>
          <option value="Book6">Book6</option>
        </select>
      </div>
      <div className="add">
        <label>Timesplayed</label>
        <input value={0} disabled type="text" />
      </div>
      <div className="add">
        <label>Type</label>
        <select onChange={handletype} value={type}>
          <option value="">Select Type</option>
          <option value="Workbook_1">Workbook_1</option>
          <option value="Workbook_2">Workbook_2</option>
          <option value="Workbook_3">Workbook_3</option>
          <option value="Workbook_4">Workbook_4</option>
          <option value="Workbook_5">Workbook_5</option>
          <option value="Workbook_6">Workbook_6</option>
        </select>
      </div>
      {/* <div className="add">
        <label>MusicName</label>
        <input type="text" onChange={handleMusicName} value={musicName} />
        <input ref={fileRef} onChange={handleMusicName} accept="audio/*" type="file"/>

      </div> */}

      <button onClick={createRealtimeUsers}>Add</button>
    </div>
  );
}
