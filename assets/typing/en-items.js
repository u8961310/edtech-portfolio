// 打字島英打三階內容（2026-11-20 原創）：初階＝字母（從基準列開始）、進階＝常用單字（150 個）、高階＝短句（40 句）
// 格式跟中打選文一樣是「文章」：{ id, lang:'en', grade:'t1'|'t2'|'t3', domain, title, text }，typing-core 逐字比對（含空白）
window.EN_ITEMS = [
  // ---- 初階：字母（基準列 → 上排 → 下排）
  { id: 'en-1-01', lang: 'en', grade: 't1', domain: '字母', title: '基準列 F J', text: 'f j f j ff jj fj jf fff jjj' },
  { id: 'en-1-02', lang: 'en', grade: 't1', domain: '字母', title: '基準列 D K', text: 'd k d k dk kd fd jk dfj kjd' },
  { id: 'en-1-03', lang: 'en', grade: 't1', domain: '字母', title: '基準列 S L', text: 's l s l sl ls sd lk sdf lkj' },
  { id: 'en-1-04', lang: 'en', grade: 't1', domain: '字母', title: '基準列 A ;', text: 'a ; a ; as ;l asdf jkl; asdf jkl;' },
  { id: 'en-1-05', lang: 'en', grade: 't1', domain: '字母', title: '基準列 G H', text: 'g h g h fg jh fgh jhg gh hg' },
  { id: 'en-1-06', lang: 'en', grade: 't1', domain: '字母', title: '上排 R U', text: 'r u r u fr ju rf uj fur ruf' },
  { id: 'en-1-07', lang: 'en', grade: 't1', domain: '字母', title: '上排 E I', text: 'e i e i de ki ed ik die kei' },
  { id: 'en-1-08', lang: 'en', grade: 't1', domain: '字母', title: '上排 W O Q P', text: 'w o q p sw lo aq ;p wo qp' },
  { id: 'en-1-09', lang: 'en', grade: 't1', domain: '字母', title: '上排 T Y', text: 't y t y ft jy ty yt try yet' },
  { id: 'en-1-10', lang: 'en', grade: 't1', domain: '字母', title: '下排 V M C X Z', text: 'v m c x z fv jm dc sx az' },

  // ---- 進階：常用單字（每篇 15 個，依主題）
  { id: 'en-2-01', lang: 'en', grade: 't2', domain: '單字', title: '顏色', text: 'red blue green black white pink brown gray gold purple orange yellow color dark light' },
  { id: 'en-2-02', lang: 'en', grade: 't2', domain: '單字', title: '動物', text: 'cat dog pig cow fish bird duck frog lion tiger bear rabbit monkey horse sheep' },
  { id: 'en-2-03', lang: 'en', grade: 't2', domain: '單字', title: '家人', text: 'mom dad baby boy girl man woman family sister brother friend grandpa grandma uncle aunt' },
  { id: 'en-2-04', lang: 'en', grade: 't2', domain: '單字', title: '學校', text: 'book pen desk chair bag ruler eraser pencil class teacher student school map clock door' },
  { id: 'en-2-05', lang: 'en', grade: 't2', domain: '單字', title: '食物', text: 'rice egg milk cake tea juice bread apple banana water soup candy noodles fruit meat' },
  { id: 'en-2-06', lang: 'en', grade: 't2', domain: '單字', title: '數字', text: 'one two three four five six seven eight nine ten zero many some first last' },
  { id: 'en-2-07', lang: 'en', grade: 't2', domain: '單字', title: '身體', text: 'head hand foot eye ear nose mouth arm leg face hair tooth body finger knee' },
  { id: 'en-2-08', lang: 'en', grade: 't2', domain: '單字', title: '天氣與自然', text: 'sun moon star rain snow wind cloud tree flower sky sea hot cold warm cool' },
  { id: 'en-2-09', lang: 'en', grade: 't2', domain: '單字', title: '動作', text: 'run jump walk sit stand eat drink read write sing dance swim play sleep look' },
  { id: 'en-2-10', lang: 'en', grade: 't2', domain: '單字', title: '形容詞', text: 'big small tall short long happy sad good bad new old fast slow nice cute' },

  // ---- 高階：短句（每篇 4 句）
  { id: 'en-3-01', lang: 'en', grade: 't3', domain: '句子', title: '自我介紹', text: 'I am a student. I like to read. My name is Amy. I am ten years old.' },
  { id: 'en-3-02', lang: 'en', grade: 't3', domain: '句子', title: '我的家', text: 'This is my family. My dad is tall. My mom can cook. We have a cat.' },
  { id: 'en-3-03', lang: 'en', grade: 't3', domain: '句子', title: '在學校', text: 'We go to school. The bell rings at eight. Our teacher is kind. We play at lunch.' },
  { id: 'en-3-04', lang: 'en', grade: 't3', domain: '句子', title: '天氣', text: 'It is sunny today. The sky is blue. Take your hat. Do not forget water.' },
  { id: 'en-3-05', lang: 'en', grade: 't3', domain: '句子', title: '動物朋友', text: 'The dog can run fast. The bird can fly. Fish swim in the sea. I love animals.' },
  { id: 'en-3-06', lang: 'en', grade: 't3', domain: '句子', title: '早餐', text: 'I eat eggs and bread. I drink warm milk. Breakfast is good for you. Eat it every day.' },
  { id: 'en-3-07', lang: 'en', grade: 't3', domain: '句子', title: '運動', text: 'Let us play ball. Jump high and run fast. Sports make us strong. Drink water after.' },
  { id: 'en-3-08', lang: 'en', grade: 't3', domain: '句子', title: '電腦課', text: 'Sit up straight. Put your hands on the keys. Look at the screen. Type slow and right.' },
  { id: 'en-3-09', lang: 'en', grade: 't3', domain: '句子', title: '好習慣', text: 'Wash your hands. Say please and thank you. Help your friends. Rest your eyes.' },
  { id: 'en-3-10', lang: 'en', grade: 't3', domain: '句子', title: '週末', text: 'On Sunday we go to the park. We see many trees. My sister rides a bike. We have fun.' }
];
