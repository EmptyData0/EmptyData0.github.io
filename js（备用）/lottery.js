// 辅助函数定义在外部
function displayPrizePool(prizes, container) {
    container.innerHTML = '';
    prizes.forEach(prize => {
        const prizeElement = document.createElement('div');
        prizeElement.className = 'prize-item';
        prizeElement.textContent = `${prize.name} (${(prize.probability * 100).toFixed(1)}%)`;
        if (prize.isSpecial) {
            prizeElement.style.backgroundColor = '#fff3cd';
        }
        container.appendChild(prizeElement);
    });
}

function performActualLottery(config, resultsElement, modal, modalElement) {
    resultsElement.innerHTML = '';
    let hasSpecialPrize = false;
    
    // 抽10次
    for (let i = 0; i < 10; i++) {
        const prize = getRandomPrize(config.prizes);
        createPrizeElement(prize, resultsElement);
        
        if (prize.isSpecial) {
            hasSpecialPrize = true;
        }
    }
    
    // 显示弹窗
    modalElement.textContent = hasSpecialPrize ? 
        config.messages.special : 
        config.messages.default;
    modal.style.display = "block";
}

function getRandomPrize(prizes) {
    const random = Math.random();
    let cumulativeProbability = 0;
    
    for (const prize of prizes) {
        cumulativeProbability += prize.probability;
        if (random <= cumulativeProbability) {
            return prize;
        }
    }
    
    return prizes[prizes.length - 1];
}

function createPrizeElement(prize, container) {  // 修正参数名拼写
    const prizeElement = document.createElement('div');
    prizeElement.className = 'result-item';
    prizeElement.textContent = prize.name;
    prizeElement.setAttribute('data-probability', `${(prize.probability * 100).toFixed(1)}%`);
    
    if (prize.isSpecial) {
        prizeElement.classList.add('special-prize');
    }
    
    container.appendChild(prizeElement);
}

// 主初始化函数
function initializeLottery(config) {
    const startButton = document.createElement('button');
    startButton.id = 'startLottery';
    startButton.className = 'lottery-button';
    startButton.textContent = '开始抽奖';
    
    const prizePoolElement = document.createElement('div');
    prizePoolElement.id = 'prizePool';
    prizePoolElement.className = 'prize-pool';
    
    const resultsElement = document.createElement('div');
    resultsElement.id = 'lotteryResults';
    resultsElement.className = 'results-grid';
    
    // 创建弹窗元素
    const modal = document.createElement('div');
    modal.id = 'lotteryModal';
    modal.className = 'modal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    const closeSpan = document.createElement('span');
    closeSpan.className = 'close';
    closeSpan.innerHTML = '&times;';
    
    const modalMessage = document.createElement('p');
    modalMessage.id = 'modalMessage';
    
    modalContent.appendChild(closeSpan);
    modalContent.appendChild(modalMessage);
    modal.appendChild(modalContent);
    
    // 组装页面结构
    const container = document.querySelector('.lottery-container');
    
    const poolDisplay = document.createElement('div');
    poolDisplay.className = 'pool-display';
    poolDisplay.innerHTML = '<h3>奖品池</h3>';
    poolDisplay.appendChild(prizePoolElement);
    
    const resultsArea = document.createElement('div');
    resultsArea.className = 'results-area';
    resultsArea.innerHTML = '<h3>抽奖结果</h3>';
    resultsArea.appendChild(resultsElement);
    
    container.appendChild(startButton);
    container.appendChild(poolDisplay);
    container.appendChild(resultsArea);
    document.body.appendChild(modal);
    
    // 显示奖品池
    displayPrizePool(config.prizes, prizePoolElement);
    
    // 抽奖按钮点击事件
    startButton.addEventListener('click', function() {
        startButton.disabled = true;
        startButton.textContent = "抽奖中...";
        
        // 清空上次结果
        resultsElement.innerHTML = '';
        
        // 模拟抽奖动画效果
        let counter = 0;
        const interval = setInterval(() => {
            resultsElement.innerHTML = '';
            for (let i = 0; i < 10; i++) {
                const randomIndex = Math.floor(Math.random() * config.prizes.length);
                const prize = config.prizes[randomIndex];
                createPrizeElement(prize, resultsElement);
            }
            
            counter++;
            if (counter > 10) {
                clearInterval(interval);
                performActualLottery(config, resultsElement, modal, modalMessage);
                startButton.disabled = false;
                startButton.textContent = "开始抽奖";
            }
        }, 100);
    });
    
    // 关闭弹窗事件
    closeSpan.addEventListener('click', function() {
        modal.style.display = "none";
    });
    
    modal.addEventListener('click', function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    });
}

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // 获取配置数据
    fetch('/_data/lottery.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(config => {
            initializeLottery(config);
        })
        .catch(error => {
            console.error('加载抽奖配置失败:', error);
            // 使用默认配置作为后备
            initializeLottery({
                prizes: [
                    {name: "特等奖", probability: 0.01, isSpecial: true},
                    {name: "参与奖", probability: 0.99}
                ],
                messages: {
                    default: "感谢参与抽奖！",
                    special: "恭喜获得特别奖！"
                }
            });
        });
});