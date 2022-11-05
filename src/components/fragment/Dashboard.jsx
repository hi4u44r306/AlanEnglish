import React from 'react'
import Containerfull from './Containerfull'
import firebase from 'firebase/app';
import '../assets/scss/Dashboard.scss'

class Dashboard extends React.Component {
    state ={
        studentsA: null,
        studentsB: null,
        studentsC: null,
        studentsD: null,
      }
    componentDidMount() {
        const db = firebase.firestore();
        db.collection('student').where('class', '==', 'A').orderBy('onlinetime', 'desc').get().then((snapshot) => {
            const studentsA = [];
            const studentsinfo = [];
            snapshot.forEach((doc)=>{
                const data = doc.data();
                const id = doc.id;
                studentsA.push(data);
                studentsinfo.push(id);
            })
            this.setState({studentsA: studentsA});
        });
        db.collection('student').where('class', '==', 'B').orderBy('onlinetime', 'desc').get().then((snapshot) => {
            const studentsB = [];
            const studentsinfo = [];
            snapshot.forEach((doc)=>{
                const data = doc.data();
                const id = doc.id;
                studentsB.push(data);
                studentsinfo.push(id);
            })
            this.setState({studentsB: studentsB});
        });
        db.collection('student').where('class', '==', 'C').orderBy('onlinetime', 'desc').get().then((snapshot) => {
            const studentsC = [];
            const studentsinfo = [];
            snapshot.forEach((doc)=>{
                const data = doc.data();
                const id = doc.id;
                studentsC.push(data);
                studentsinfo.push(id);
            })
            this.setState({studentsC: studentsC});
        });
        db.collection('student').where('class', '==', 'D').orderBy('onlinetime', 'desc').get().then((snapshot) => {
            const studentsD = [];
            const studentsinfo = [];
            snapshot.forEach((doc)=>{
                const data = doc.data();
                const id = doc.id;
                studentsD.push(data);
                studentsinfo.push(id);
            })
            this.setState({studentsD: studentsD});
        });
    }
render(){
  return (
            <>
                <Containerfull>
                <div className='leaderboardtitle'>
                    Dashboard
                </div>
                <div className='notice'>
                ⚠️ 若名字沒有在上面表示從來沒有上線過 ⚠️
                </div>
                {/* <div className='filtercontainer'>
                    <button>
                        All
                    </button>
                    <button>
                        A班
                    </button>
                    <button>
                        B班
                    </button>
                    <button>
                        C班
                    </button>
                    <button>
                        D班
                    </button>
                </div> */}
                {/* A班 */}
                <div className='classtitle'>A班</div>
                    <table className='table table-border'>
                        <thead>
                            <tr>
                                <th className='dashboardcoltitle'>✨ 上線日期</th>
                                <th className='dashboardcoltitle'>🏆 班級</th>
                                <th className='dashboardcoltitle'>👦 姓名 👩</th>
                            </tr>
                        </thead>
                        <tbody>
                        {
                            this.state.studentsA &&
                            this.state.studentsA.map((studentsA, index) =>{
                                return(
                                <tr key={index}>
                                    <td key={studentsA.onlinetime}>
                                    <div className='d-flex justify-content-center'>
                                        <div className="align-self-center pl-3">
                                        <b>
                                            <span className='font-weight-bold'>
                                            <span className={studentsA.onlinetime?'text-success' || '':'text-danger'}>
                                                {studentsA.onlinetime || '近期無上線'}
                                            </span>
                                            </span>
                                        </b>
                                        </div>
                                    </div>
                                    </td>
                                    <td key={studentsA.class}>
                                    <div className='d-flex justify-content-center'>
                                        <div className="align-self-center pl-3">
                                        <b>
                                            <span className='font-weight-bold'>
                                            <span className={studentsA.class?'text-success' || '':'text-danger'}>
                                                {studentsA.class || '近期無上線'}
                                            </span>
                                            </span>
                                        </b>
                                        </div>
                                    </div>
                                    </td>
                                    <td key={studentsA.name}>
                                    <div className='d-flex justify-content-center'>
                                        <div className="align-self-center pl-3">
                                        <b><span className='font-weight-bold'>{studentsA.name}</span></b>
                                        </div>
                                    </div>
                                    </td>
                                </tr>
                                )
                                })
                            }
                        </tbody>
                        <tfoot>
                            <tr>
                                <td className='coltitle' colSpan="5">!!這是A班最後一筆資料了!!</td>
                            </tr>
                        </tfoot>
                    </table>
                {/* B班 */}
                <div className='classtitle'>B班</div>
                    <table className='table table-border'>
                        <thead>
                            <tr>
                                <th className='dashboardcoltitle'>✨ 上線日期</th>
                                <th className='dashboardcoltitle'>🏆 班級</th>
                                <th className='dashboardcoltitle'>👦 姓名 👩</th>
                            </tr>
                        </thead>
                        <tbody>
                        {
                            this.state.studentsB &&
                            this.state.studentsB.map((studentsB, index) =>{
                                return(
                                <tr key={index}>
                                    <td key={studentsB.onlinetime}>
                                    <div className='d-flex justify-content-center'>
                                        <div className="align-self-center pl-3">
                                        <b>
                                            <span className='font-weight-bold'>
                                            <span className={studentsB.onlinetime?'text-success' || '':'text-danger'}>
                                                {studentsB.onlinetime || '近期無上線'}
                                            </span>
                                            </span>
                                        </b>
                                        </div>
                                    </div>
                                    </td>
                                    <td key={studentsB.class}>
                                    <div className='d-flex justify-content-center'>
                                        <div className="align-self-center pl-3">
                                        <b>
                                            <span className='font-weight-bold'>
                                            <span className={studentsB.class?'text-success' || '':'text-danger'}>
                                                {studentsB.class || '近期無上線'}
                                            </span>
                                            </span>
                                        </b>
                                        </div>
                                    </div>
                                    </td>
                                    <td key={studentsB.name}>
                                    <div className='d-flex justify-content-center'>
                                        <div className="align-self-center pl-3">
                                        <b><span className='font-weight-bold'>{studentsB.name}</span></b>
                                        </div>
                                    </div>
                                    </td>
                                </tr>
                                )
                                })
                            }
                        </tbody>
                        <tfoot>
                            <tr>
                                <td className='coltitle' colSpan="5">!!這是B班最後一筆資料了!!</td>
                            </tr>
                        </tfoot>
                    </table>
                {/* C班 */}
                <div className='classtitle'>C班</div>
                    <table className='table table-border'>
                        <thead>
                            <tr>
                                <th className='dashboardcoltitle'>✨ 上線日期</th>
                                <th className='dashboardcoltitle'>🏆 班級</th>
                                <th className='dashboardcoltitle'>👦 姓名 👩</th>
                            </tr>
                        </thead>
                        <tbody>
                        {
                            this.state.studentsC &&
                            this.state.studentsC.map((studentsC, index) =>{
                                return(
                                <tr key={index}>
                                    <td key={studentsC.onlinetime}>
                                    <div className='d-flex justify-content-center'>
                                        <div className="align-self-center pl-3">
                                        <b>
                                            <span className='font-weight-bold'>
                                            <span className={studentsC.onlinetime?'text-success' || '':'text-danger'}>
                                                {studentsC.onlinetime || '近期無上線'}
                                            </span>
                                            </span>
                                        </b>
                                        </div>
                                    </div>
                                    </td>
                                    <td key={studentsC.class}>
                                    <div className='d-flex justify-content-center'>
                                        <div className="align-self-center pl-3">
                                        <b>
                                            <span className='font-weight-bold'>
                                            <span className={studentsC.class?'text-success' || '':'text-danger'}>
                                                {studentsC.class || '近期無上線'}
                                            </span>
                                            </span>
                                        </b>
                                        </div>
                                    </div>
                                    </td>
                                    <td key={studentsC.name}>
                                    <div className='d-flex justify-content-center'>
                                        <div className="align-self-center pl-3">
                                        <b><span className='font-weight-bold'>{studentsC.name}</span></b>
                                        </div>
                                    </div>
                                    </td>
                                </tr>
                                )
                                })
                            }
                        </tbody>
                        <tfoot>
                            <tr>
                                <td className='coltitle' colSpan="5">!!這是C班最後一筆資料了!!</td>
                            </tr>
                        </tfoot>
                    </table>
                {/* D班 */}
                <div className='classtitle'>D班</div>
                    <table className='table table-border'>
                        <thead>
                            <tr>
                                <th className='dashboardcoltitle'>✨ 上線日期</th>
                                <th className='dashboardcoltitle'>🏆 班級</th>
                                <th className='dashboardcoltitle'>👦 姓名 👩</th>
                            </tr>
                        </thead>
                        <tbody>
                        {
                            this.state.studentsD &&
                            this.state.studentsD.map((studentsD, index) =>{
                                return(
                                <tr key={index}>
                                    <td key={studentsD.onlinetime}>
                                    <div className='d-flex justify-content-center'>
                                        <div className="align-self-center pl-3">
                                        <b>
                                            <span className='font-weight-bold'>
                                            <span className={studentsD.onlinetime?'text-success' || '':'text-danger'}>
                                                {studentsD.onlinetime || '近期無上線'}
                                            </span>
                                            </span>
                                        </b>
                                        </div>
                                    </div>
                                    </td>
                                    <td key={studentsD.class}>
                                    <div className='d-flex justify-content-center'>
                                        <div className="align-self-center pl-3">
                                        <b>
                                            <span className='font-weight-bold'>
                                            <span className={studentsD.class?'text-success' || '':'text-danger'}>
                                                {studentsD.class || '近期無上線'}
                                            </span>
                                            </span>
                                        </b>
                                        </div>
                                    </div>
                                    </td>
                                    <td key={studentsD.name}>
                                    <div className='d-flex justify-content-center'>
                                        <div className="align-self-center pl-3">
                                        <b><span className='font-weight-bold'>{studentsD.name}</span></b>
                                        </div>
                                    </div>
                                    </td>
                                </tr>
                                )
                                })
                            }
                        </tbody>
                        <tfoot>
                            <tr>
                                <td className='coltitle' colSpan="5">!!這是D班最後一筆資料了!!</td>
                            </tr>
                        </tfoot>
                    </table>
                </Containerfull>
            </>
        )
    }
}

export default Dashboard