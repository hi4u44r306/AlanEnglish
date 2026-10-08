import React from "react";

export function copyItemProblems(items, books, tracks, pages, aiMaterials) {
    const problems = [];
    items.forEach((item, index) => {
        const prefix = `活動 ${index + 1}：`;
        if (!books.some(book => Number(book.id) === Number(item.book_id))) problems.push(prefix + "教材不在本班目前教材中，請重新選擇。");
        if (item.item_type === "listening") {
            if (!item.track_ids.length || item.track_ids.some(id => !tracks.some(track => Number(track.id) === id && Number(track.book_id) === Number(item.book_id)))) {
                problems.push(prefix + "音檔不存在、已停用或未選擇，請重新選擇。");
            }
        } else {
            const selectedPages = pages.filter(page => item.page_content_ids.includes(Number(page.id)) && Number(page.book_id) === Number(item.book_id) && page.status === "published");
            if (!item.page_content_ids.length || selectedPages.length !== item.page_content_ids.length) problems.push(prefix + "部分頁面來源已停用或未核准，請重新選擇。");
            if (item.item_type === "ai_quiz" && !aiMaterials.some(ai => Number(ai.id) === Number(item.ai_material_id))) problems.push(prefix + "原 AI 題組目前不可用，請選擇自己的已檢閱題組。");
            if (item.item_type === "pronunciation") {
                const available = selectedPages.flatMap(page => (page.pronunciation_prompts || []).map(prompt => `${page.id}:${prompt}`));
                if (!item.prompt_keys.length || item.prompt_keys.some(key => !available.includes(key))) problems.push(prefix + "發音提示已變更或未選擇，請重新選擇。");
            }
        }
    });
    return problems;
}

const toggle = (values, value) => values.includes(value) ? values.filter(current => current !== value) : [...values, value];
const labels = { listening: "聽力", ai_quiz: "AI 選擇題", pronunciation: "發音練習" };

export default function AssignmentCopyEditor({ items, onChange, books, tracks, pages, aiMaterials, disabled }) {
    const update = (index, patch) => onChange(items.map((item, position) => position === index ? { ...item, ...patch } : item));
    const problems = copyItemProblems(items, books, tracks, pages, aiMaterials);
    return <section className="assignment-copy-editor" aria-label="複製的活動設定">
        <h3>複製的活動設定</h3>
        <p>請核對教材、頁面與完成條件；發布時會重新取得目前核准內容。</p>
        {problems.length > 0 && <div role="status" className="assignment-copy-problems">{problems.map(problem => <p key={problem}>{problem}</p>)}</div>}
        {items.map((item, index) => {
            const availableTracks = tracks.filter(track => Number(track.book_id) === Number(item.book_id));
            const availablePages = pages.filter(page => Number(page.book_id) === Number(item.book_id) && page.status === "published");
            const availablePrompts = availablePages.filter(page => item.page_content_ids?.includes(Number(page.id))).flatMap(page =>
                (page.pronunciation_prompts || []).map(prompt => ({ key: `${page.id}:${prompt}`, label: `${page.page_label} · ${prompt}` })));
            return <fieldset className="assignment-form-section" key={index} disabled={disabled}>
                <legend>{index + 1}. {labels[item.item_type]}</legend>
                <label><span>活動 {index + 1} 教材</span><select value={item.book_id} onChange={event => update(index, {
                    book_id: Number(event.target.value), track_ids: [], page_content_ids: [], prompt_keys: [], page_from_label: "", page_to_label: ""
                })}>
                    <option value="">請選擇教材</option>
                    {!books.some(book => Number(book.id) === Number(item.book_id)) && <option value={item.book_id}>原教材已不可用</option>}
                    {books.map(book => <option key={book.id} value={book.id}>{book.name}</option>)}
                </select></label>
                {item.item_type === "listening" ? <>
                    <label><span>活動 {index + 1} 每檔聆聽次數</span><input type="number" min="1" max="10" value={item.required_listens} onChange={event => update(index, { required_listens: Number(event.target.value) })} /></label>
                    <button type="button" onClick={() => update(index, { track_ids: [] })}>清除音檔選擇</button>
                    <div className="assignment-track-list">{availableTracks.map(track => <label key={track.id}>
                        <input type="checkbox" checked={item.track_ids.includes(Number(track.id))} onChange={() => update(index, { track_ids: toggle(item.track_ids, Number(track.id)) })} />
                        <span>{track.display_page || track.page}</span>
                    </label>)}</div>
                </> : <>
                    <button type="button" onClick={() => update(index, { page_content_ids: [], prompt_keys: [], page_from_label: "", page_to_label: "" })}>清除頁面選擇</button>
                    <div className="assignment-track-list">{availablePages.map(page => <label key={page.id}>
                        <input type="checkbox" checked={item.page_content_ids.includes(Number(page.id))} onChange={() => {
                            const pageIds = toggle(item.page_content_ids, Number(page.id));
                            const keys = availablePages.filter(row => pageIds.includes(Number(row.id))).flatMap(row => (row.pronunciation_prompts || []).map(prompt => `${row.id}:${prompt}`));
                            update(index, { page_content_ids: pageIds, prompt_keys: (item.prompt_keys || []).filter(key => keys.includes(key)), page_from_label: "", page_to_label: "" });
                        }} /><span>{page.page_label} · 第 {page.version || 1} 版</span>
                    </label>)}</div>
                    {item.item_type === "ai_quiz" ? <>
                        <label><span>活動 {index + 1} AI 題組</span><select value={item.ai_material_id} onChange={event => update(index, { ai_material_id: Number(event.target.value) })}>
                            <option value="">請選擇已檢閱題組</option>
                            {!aiMaterials.some(ai => Number(ai.id) === Number(item.ai_material_id)) && <option value={item.ai_material_id}>原題組已不可用</option>}
                            {aiMaterials.map(ai => <option key={ai.id} value={ai.id}>{ai.title}</option>)}
                        </select></label>
                        <label><span>活動 {index + 1} 達標分數</span><input type="number" min="1" max="100" value={item.passing_score} onChange={event => update(index, { passing_score: Number(event.target.value) })} /></label>
                    </> : <>
                        <div className="assignment-track-list">{availablePrompts.map(prompt => <label key={prompt.key}><input type="checkbox" checked={item.prompt_keys.includes(prompt.key)} onChange={() => update(index, { prompt_keys: toggle(item.prompt_keys, prompt.key) })} /><span>{prompt.label}</span></label>)}</div>
                        <label><span>活動 {index + 1} 發音完成方式</span><select value={item.completion_mode} onChange={event => update(index, { completion_mode: event.target.value, target_score: event.target.value === "target_score" ? item.target_score || 80 : null })}>
                            <option value="practice">完成練習</option><option value="target_score">達到指定分數</option>
                        </select></label>
                        {item.completion_mode === "target_score" && <label><span>活動 {index + 1} 發音達標分數</span><input type="number" min="40" max="100" value={item.target_score} onChange={event => update(index, { target_score: Number(event.target.value) })} /></label>}
                        <label><span>活動 {index + 1} 最多評分次數</span><input type="number" min="1" max="5" value={item.max_scored_attempts} onChange={event => update(index, { max_scored_attempts: Number(event.target.value) })} /></label>
                    </>}
                </>}
                <button type="button" onClick={() => onChange(items.filter((_, position) => position !== index))}>移除此活動</button>
            </fieldset>;
        })}
    </section>;
}
