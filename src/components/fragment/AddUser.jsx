// import React from 'react'
// import firebase from 'firebase';
// import { useState, useRef } from 'react';

// const AddUser = () => {

//     const emailRef = useRef(); 
//     const passwordRef = useRef(); 
//     const auth = firebase.auth();
    
//     function signUp() {
  
//     const promise = auth.createUserWithEmailAndPassword(emailRef.value, passwordRef.value);
//     promise.catch(e => alert(e.message));
  
//     alert("Signed Up");
  
//   }

//     // function signup(email,password) {
//     //     return firebase.auth().createUserWithEmailAndPassword(email,password);
//     // }
//     // async function handleSubmit(e){
//     //     e.preventDefault();
//     //     try{
//     //         await signup(emailRef.current.value, passwordRef.current.value);
//     //     }catch{
//     //         alert("something went wrong");
//     //     }
//     // }

//   return (
//     <div>
//         <h1>AddUser</h1>
//         <form onSubmit={signUp()}>
//             <div className="input-field">
//                 <label>Name : </label>
//                 <input type="text" id="signup-name"/>
//             </div>
//             <div className="input-field">
//                 <label>Email : </label>
//                 <input name="email" type="email" ref={emailRef}/>
//             </div>
//             <div className="input-field">
//                 <label>Password : </label>
//                 <input name="password" type="password" ref={passwordRef}/>
//             </div>
//             <div className="input-field">
//                 <label>Class : </label>
//                 <input type="text" id="signup-classtype"/>
//             </div>
//             <button>CreateUser</button>
//         </form>
//     </div>
//   )
// }

// export default AddUser