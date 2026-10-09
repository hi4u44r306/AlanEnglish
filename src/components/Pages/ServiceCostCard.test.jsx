import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ServiceCostCard from './ServiceCostCard';
import { saveServiceCost } from '../../services/costAlertService';
jest.mock('../../services/costAlertService',()=>({saveServiceCost:jest.fn()}));
const provider={id:'azure',name:'Azure Speech',category:'錄音發音評分',note:'帳務有延遲。',enabled:true,incomplete:true,fixed_monthly_usd:null,local_cost_usd:null,reported_cost_usd:null,known_cost_usd:0,metrics:[],error_code:'missing_configuration'};
beforeEach(()=>jest.clearAllMocks());
test('unknown cost displays a gap instead of a zero bill',()=>{
    render(<ServiceCostCard provider={provider} month="2026-10" />);
    expect(screen.getByText('尚未接通帳務權限')).toBeInTheDocument();expect(screen.queryByText(/US\$ 0/)).not.toBeInTheDocument();expect(screen.getByText(/尚有未取得金額/)).toBeInTheDocument();
});
test('a free fixed plan fee cannot masquerade as a complete zero bill',()=>{
    render(<ServiceCostCard provider={{...provider,error_code:null,fixed_monthly_usd:0}} month="2026-10" />);
    expect(screen.getByText('待核對')).toBeInTheDocument();
    expect(screen.getByText('僅確認固定月費')).toBeInTheDocument();
    expect(document.querySelector('.api-service-amount strong')).not.toHaveTextContent('US$ 0');
});
test('stale billing retains cost and its successful timestamp',()=>{
    render(<ServiceCostCard provider={{...provider,incomplete:false,error_code:null,reported_cost_usd:12,known_cost_usd:12,stale:true,collected_at:'2026-10-06T00:00:00Z'}} month="2026-10" />);
    expect(screen.getByText('US$ 12')).toBeInTheDocument();expect(screen.getByText('資料已過期，等待更新')).toBeInTheDocument();expect(screen.getByText(/2026/)).toBeInTheDocument();
});
test('zero and unlimited quota limits are rendered without NaN or false unlimited claims',()=>{
    render(<ServiceCostCard provider={{...provider,metrics:[{name:'每日信件',used:1,unit:'封',limit:0},{name:'每月信件',used:20,unit:'封',limit:null}]}} month="2026-10" />);
    expect(screen.getByText('無可用額度')).toBeInTheDocument();expect(screen.getByText('20 封')).toBeInTheDocument();expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
});
test('plan and monthly complete total save through the verified API, with null for unknown',async()=>{
    saveServiceCost.mockResolvedValue({success:true});const onSaved=jest.fn();const user={};
    render(<ServiceCostCard provider={provider} firebaseUser={user} month="2026-10" onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button',{name:'設定方案費用'}));
    fireEvent.change(screen.getByLabelText(/完整總額/),{target:{value:'10'}});fireEvent.click(screen.getByRole('button',{name:'儲存此服務'}));
    await waitFor(()=>expect(onSaved).toHaveBeenCalled());expect(saveServiceCost).toHaveBeenCalledWith(user,{provider_id:'azure',month:'2026-10',fixed_monthly_usd:null,month_total_usd:10,enabled:true});
});
test('failed save leaves the editor open and does not pretend the amount changed',async()=>{
    saveServiceCost.mockRejectedValue(new Error('帳務設定未儲存'));const onSaved=jest.fn();
    render(<ServiceCostCard provider={provider} month="2026-10" onSaved={onSaved} />);fireEvent.click(screen.getByRole('button',{name:'設定方案費用'}));fireEvent.click(screen.getByRole('button',{name:'儲存此服務'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('帳務設定未儲存');expect(onSaved).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'儲存此服務'})).toBeInTheDocument();
});
