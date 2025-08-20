/**
 * 完整抽奖系统 v5.0
 * 功能：抽数系统、保底机制、历史记录、界面优化
 */

const LotteryManager = {
  // ==================== 状态管理 ====================
  state: {
    drawCount: 0,        // 保底计数器
    tickets: 1,          // 初始赠送1抽
    history: [],         // 抽奖历史
    config: {            // 默认配置
      prizeCategories: [
        {
          name: "一等奖",
          probability: 0.05,
          isSpecial: true,
          isTopPrize: true,
          subPrizes: [
            {name: "wowo", probability: 0.5},
            {name: "nini", probability: 0.3},
            {name: "sbsb", probability: 0.2}
          ]
        },
        {
          name: "参与奖", 
          probability: 0.95,
          subPrizes: [
            {name: "谢谢参与", probability: 1.0}
          ]
        }
      ],
      messages: {
        default: "感谢参与抽奖！",
        special: "恭喜获得特别奖！",
        noTickets: "抽卡次数不足，请移步界面底部获取更多抽数"
      },
      guarantee: {
        count: 90,
        prizeCategory: "一等奖"
      },
      historySize: 180
    },
    domRefs: null        // DOM引用
  },

  // ==================== 初始化方法 ====================
  init() {
    this.loadConfig()
      .then(config => {
        // 合并配置
        this.state.config = {
          ...this.state.config,
          ...config,
          // 保留保证的配置项
          guarantee: this.state.config.guarantee,
          historySize: this.state.config.historySize
        };
        
        this.loadState();
        this.initDOM();
        this.setupEventListeners();
        this.render();
        this.updateTicketDisplay();
      })
      .catch(err => {
        console.error("初始化失败:", err);
        this.showError("系统加载失败，请刷新页面");
      });
  },

  // ==================== 数据管理 ====================
  loadConfig() {
    return fetch('/js/lottery.json')
      .then(res => res.ok ? res.json() : Promise.reject())
      .catch(() => {
        console.warn("使用默认配置");
        return this.state.config;
      });
  },

  loadState() {
    try {
      const saved = localStorage.getItem('lotteryState');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state.drawCount = parsed.drawCount || 0;
        this.state.tickets = parsed.tickets || 1;
        this.state.history = (parsed.history || [])
          .map(record => ({
            ...record,
            time: new Date(record.time)
          }))
          .slice(0, this.state.config.historySize);
      }
    } catch (err) {
      console.error("加载状态失败:", err);
    }
  },

  saveState() {
    try {
      localStorage.setItem('lotteryState', JSON.stringify({
        drawCount: this.state.drawCount,
        tickets: this.state.tickets,
        history: this.state.history.slice(0, this.state.config.historySize)
      }));
    } catch (err) {
      console.error("保存状态失败:", err);
    }
  },

  // ==================== DOM操作 ====================
  initDOM() {
    const container = document.querySelector('.lottery-container');
    if (!container) throw new Error("找不到抽奖容器");

    container.innerHTML = `
      <div class="action-bar">
        <button id="singleDraw" class="lottery-button">单抽 (消耗1抽)</button>
        <button id="multiDraw" class="lottery-button">十连 (消耗10抽)</button>
        <button id="viewHistory" class="lottery-button">提取记录</button>
        <div class="counter">
          保底计数: <span id="guaranteeCounter">${this.getRemainingGuarantee()}</span>/90
        </div>
      </div>
      
      <div class="results-area">
        <h3>提取结果</h3>
        <div id="lotteryResults" class="results-grid"></div>
      </div>
      
      <div class="pool-display">
        <h3>概率详情</h3>
        <div id="prizePool" class="prize-pool"></div>
      </div>
      
      <div class="ticket-section">
        <button id="getTicketBtn" class="ticket-button">点击获取抽数</button>
        <div class="ticket-counter">当前抽数: <span id="ticketCount">1</span></div>
      </div>
      
      <div id="lotteryModal" class="modal">
        <div class="modal-content">
          <span class="close">&times;</span>
          <p id="modalMessage"></p>
        </div>
      </div>
    `;

    this.state.domRefs = {
      container,
      results: document.getElementById('lotteryResults'),
      prizePool: document.getElementById('prizePool'),
      buttons: {
        single: document.getElementById('singleDraw'),
        multi: document.getElementById('multiDraw'),
        history: document.getElementById('viewHistory'),
        getTicket: document.getElementById('getTicketBtn')
      },
      counters: {
        guarantee: document.getElementById('guaranteeCounter'),
        ticket: document.getElementById('ticketCount')
      },
      modal: {
        element: document.getElementById('lotteryModal'),
        message: document.getElementById('modalMessage'),
        close: document.querySelector('.close')
      }
    };
  },

  render() {
    this.renderPrizePool();
    this.updateCounter();
  },

  renderPrizePool() {
    const { prizePool } = this.state.domRefs;
    const { prizeCategories } = this.state.config;
    
    prizePool.innerHTML = prizeCategories.map(category => `
      <div class="prize-category-item">
        <strong>${category.name} (${(category.probability * 100).toFixed(1)}%)</strong>
        ${category.subPrizes?.length ? `
          <div class="sub-prizes">
            ${category.subPrizes.map(sub => `
              <div class="sub-prize-item">
                ${sub.name} (${(sub.probability * 100).toFixed(1)}%)
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `).join('');
  },

  // ==================== 抽奖逻辑 ====================
  async performDraw(drawCount) {
    // 检查抽数是否足够
    if (!this.useTicket(drawCount)) {
      this.showModal("提示", this.state.config.messages.noTickets);
      return;
    }

    this.disableButtons();
    
    try {
      // 抽奖动画
      await this.runDrawAnimation(drawCount);
      
      // 执行实际抽奖
      const results = this.generateResults(drawCount);
      this.processResults(results, drawCount);
      this.displayResults(results);
      this.showResultModal(results);
      
    } catch (err) {
      console.error("提取出错:", err);
      this.showError("提取过程中出错");
    } finally {
      this.enableButtons();
    }
  },

  runDrawAnimation(drawCount) {
    return new Promise(resolve => {
      let frameCount = 0;
      const animate = () => {
        this.state.domRefs.results.innerHTML = '';
        
        // 创建临时奖品元素
        for (let i = 0; i < drawCount; i++) {
          const tempElement = document.createElement('div');
          tempElement.className = 'result-item temp-item';
          tempElement.innerHTML = `
            <div class="prize-category">提取中...</div>
            <div class="prize-name">?</div>
          `;
          this.state.domRefs.results.appendChild(tempElement);
        }
        
        if (++frameCount > 5) {
          resolve();
        } else {
          setTimeout(animate, 100);
        }
      };
      
      animate();
    });
  },

  generateResults(drawCount) {
    const results = [];
    let gotSpecial = false;
    let gotGuaranteed = false;
    const remainingGuarantee = this.getRemainingGuarantee();

    // 检查是否需要触发保底
    const shouldTriggerGuarantee = remainingGuarantee <= drawCount;
    let guaranteeTriggered = false;

    for (let i = 0; i < drawCount; i++) {
      let prize;
      
      // 触发保底（在最后一次抽奖时触发）
      if (shouldTriggerGuarantee && !guaranteeTriggered && i === drawCount - 1) {
        prize = this.getGuaranteedPrize();
        guaranteeTriggered = true;
        gotGuaranteed = true;
      } else {
        prize = this.getRandomPrize();
      }
      
      if (prize.isSpecial) {
        gotSpecial = true;
      }
      
      results.push(prize);
    }

    return { items: results, gotSpecial, gotGuaranteed };
  },

  processResults(results, drawCount) {
    // 更新抽奖计数
    this.state.drawCount += drawCount;
    
    // 如果抽到特别奖，重置保底计数
    if (results.gotSpecial) {
      this.state.drawCount = 0;
    }
    
    // 如果是保底获得的奖品，调整计数
    if (results.gotGuaranteed) {
      this.state.drawCount = Math.max(0, drawCount - 1);
    }
    
    // 记录历史
    this.state.history.unshift({
      time: new Date(),
      items: results.items
    });
    
    // 限制历史记录数量
    if (this.state.history.length > this.state.config.historySize) {
      this.state.history.pop();
    }
    
    this.saveState();
    this.updateCounter();
  },

  // ==================== 抽数管理 ====================
  addTicket() {
    this.state.tickets += 1;
    this.updateTicketDisplay();
    this.saveState();
    this.showToast("+1抽~");
  },

  useTicket(count) {
    if (this.state.tickets >= count) {
      this.state.tickets -= count;
      this.updateTicketDisplay();
      this.saveState();
      return true;
    }
    return false;
  },

  updateTicketDisplay() {
    this.state.domRefs.counters.ticket.textContent = this.state.tickets;
    
    // 更新按钮状态
    this.state.domRefs.buttons.single.disabled = this.state.tickets < 1;
    this.state.domRefs.buttons.multi.disabled = this.state.tickets < 10;
  },

  // ==================== 保底机制 ====================
  getRemainingGuarantee() {
    return Math.max(0, this.state.config.guarantee.count - this.state.drawCount);
  },

  getGuaranteedPrize() {
  const { prizeCategories = [] } = this.state.config || {};
  
  // 1. 获取所有三星奖品（合并所有顶级类别的子奖品）
  const allTopSubPrizes = [];
  prizeCategories.forEach(category => {
    if (category.isTopPrize && category.subPrizes) {
      allTopSubPrizes.push(...category.subPrizes.map(sub => ({
        ...sub,
        parentCategory: category.name // 保留所属类别信息
      })));
    }
  });

  // 2. 如果没有三星奖品，使用默认值
  if (allTopSubPrizes.length === 0) {
    console.warn("配置警告：没有找到三星子奖品");
    return {
      category: "保底奖品",
      name: "随机三星人格",
      isSpecial: true,
      isGuaranteed: true,
      isTopPrize: true
    };
  }

  // 3. 真正随机选择（不考虑概率权重）
  const randomIndex = Math.floor(Math.random() * allTopSubPrizes.length);
  const selected = allTopSubPrizes[randomIndex];
  
  return {
    category: selected.parentCategory || "三星奖品",
    name: selected.name,
    isSpecial: true,
    isGuaranteed: true,
    isTopPrize: true
  };
},

  // ==================== 奖品选择 ====================
  getRandomPrize() {
    const roll = Math.random();
    let cumulativeProb = 0;
    const { prizeCategories } = this.state.config;

    for (const category of prizeCategories) {
      cumulativeProb += category.probability;
      if (roll <= cumulativeProb) {
        return this.selectSubPrize(category);
      }
    }

    return this.getDefaultPrize();
  },

  selectSubPrize(category) {
  const subPrizes = category.subPrizes || [];
  const equalProbability = 1 / subPrizes.length; // 自动计算均等概率
  
  const roll = Math.random();
  let cumulativeProb = 0;

  for (const subPrize of subPrizes) {
    cumulativeProb += equalProbability; // 使用均分值
    if (roll <= cumulativeProb) {
      return {
        category: category.name,
        name: subPrize.name,
        isSpecial: category.isSpecial || false
      };
    }
  }
  
  // 保底返回第一个
  return {
    category: category.name,
    name: subPrizes[0]?.name || category.name,
    isSpecial: category.isSpecial || false
  };
},

  getDefaultPrize() {
    return {
      category: "出错啦",
      name: "保底被吃了qwq",
      isSpecial: false
    };
  },

  // ==================== 界面交互 ====================
  displayResults(results) {
  const { results: resultsContainer } = this.state.domRefs;
  resultsContainer.innerHTML = '';
  
  results.items.forEach(prize => {
    const element = document.createElement('div');
    element.className = `result-item ${prize.isSpecial ? 'special-prize' : ''} ${
      prize.isTopPrize ? 'top-prize' : ''}`;
    
    element.innerHTML = `
      <div class="prize-category">${prize.category}</div>
      <div class="prize-name">${prize.name}</div>
      ${prize.isGuaranteed ? '<div class="guaranteed-badge">保底</div>' : ''}
      ${prize.isTopPrize ? '<div class="stars">⭐⭐⭐</div>' : ''}
    `;
    resultsContainer.appendChild(element);
  });
},

  showResultModal(results) {
    const { message, element } = this.state.domRefs.modal;
    const { messages } = this.state.config;
    
    message.innerHTML = results.gotSpecial ? `
      <p>${messages.special}</p>
      <p>获得人格: ${
        results.items
          .filter(item => item.isSpecial)
          .map(item => `${item.category}-${item.name}`)
          .join(', ')
      }</p>
      ${results.gotGuaranteed ? '<p class="guaranteed-notice">※ 你的三灯人格吃保底啦！</p>' : ''}
    ` : messages.default;
    
    element.style.display = 'block';
  },

  showModal(title, content) {
    const { message, element } = this.state.domRefs.modal;
    message.innerHTML = `
      <h4>${title}</h4>
      <p>${content}</p>
    `;
    element.style.display = 'block';
  },

  showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = msg;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
      setTimeout(() => toast.remove(), 2000);
    }, 100);
  },

  updateCounter() {
    this.state.domRefs.counters.guarantee.textContent = this.getRemainingGuarantee();
  },

  disableButtons() {
    const { buttons } = this.state.domRefs;
    buttons.single.disabled = true;
    buttons.multi.disabled = true;
    buttons.getTicket.disabled = true;
    buttons.single.innerHTML = '提取中...';
    buttons.multi.innerHTML = '提取中...';
  },

  enableButtons() {
    const { buttons } = this.state.domRefs;
    buttons.single.disabled = this.state.tickets < 1;
    buttons.multi.disabled = this.state.tickets < 10;
    buttons.getTicket.disabled = false;
    buttons.single.innerHTML = '单抽 (消耗1抽)';
    buttons.multi.innerHTML = '十连！ (消耗10抽)';
  },

  closeModal() {
    this.state.domRefs.modal.element.style.display = 'none';
  },

  showError(msg) {
    const errorElement = document.createElement('div');
    errorElement.className = 'lottery-error';
    errorElement.innerHTML = `
      <p>${msg}</p>
      <button onclick="window.location.reload()">刷新页面</button>
    `;
    this.state.domRefs.container.appendChild(errorElement);
  },

  // ==================== 事件监听 ====================
  setupEventListeners() {
    const { buttons, modal } = this.state.domRefs;
    
    buttons.single.addEventListener('click', () => this.performDraw(1));
    buttons.multi.addEventListener('click', () => this.performDraw(10));
    buttons.history.addEventListener('click', () => {
      window.location.href = '/lottery/history';
    });
    buttons.getTicket.addEventListener('click', () => this.addTicket());
    
    modal.close.addEventListener('click', () => this.closeModal());
    modal.element.addEventListener('click', (e) => {
      if (e.target === modal.element) this.closeModal();
    });
  },

  // ==================== 历史记录页面 ====================
  showHistoryPage() {
    const container = document.querySelector('.lottery-history-container');
    if (!container) return;
    
    container.innerHTML = `
      <h2>人格提取记录 (最近${Math.min(this.state.history.length, this.state.config.historySize)}条)</h2>
      <div class="history-actions">
        <button onclick="window.location.href='/lottery/'" class="back-button">返回提取界面</button>
        <button id="clearHistory" class="danger-button">清空提取记录</button>
      </div>
      <div id="historyList" class="history-list">
        ${this.state.history.length ? 
          this.state.history.map(record => this.renderHistoryRecord(record)).join('') : 
          '<p>暂无提取记录</p>'}
      </div>
    `;
    
    document.getElementById('clearHistory').addEventListener('click', () => {
      if (confirm('确定要清空所有提取记录吗？此操作不可撤销！')) {
        this.clearHistory();
      }
    });
  },

  clearHistory() {
    this.state.history = [];
    this.saveState();
    this.showHistoryPage();
  },

  renderHistoryRecord(record) {
    return `
      <div class="history-record">
        <div class="record-header">
          <span>${record.time.toLocaleString()}</span>
          <span>${record.items.length}抽</span>
        </div>
        <div class="record-items">
          ${record.items.map(item => `
            <div class="record-item ${item.isSpecial ? 'special' : ''}">
              ${item.category} - ${item.name}
              ${item.isGuaranteed ? '<span class="guaranteed-badge">保底</span>' : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
};

// ==================== 页面初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.pathname.includes('/history')) {
    // 历史记录页面初始化
    LotteryManager.loadConfig()
      .then(config => {
        LotteryManager.state.config = config;
        LotteryManager.loadState();
        LotteryManager.showHistoryPage();
      });
  } else {
    // 主抽奖页面初始化
    LotteryManager.init();
  }
});