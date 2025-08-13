// Gandi 反作弊扩展
// This script is designed to be a Gandi extension to detect and prevent
// malicious data manipulation and API abuse by third-party scripts.

// The core class of the extension, which contains all the logic.
class GandiAntiCheatExtension {
  // The constructor is called when the extension is created.
  // It receives the Scratch VM instance as an argument.
  constructor(vm) {
    this.vm = vm;
    this.patches = new Map(); // Store original methods to un-patch later if needed.
    this.lastDataUpdateTime = 0;
    this.updateCount = 0;
    this.updateThreshold = 10; // Allow 10 updates per second for normal behavior.
    this.initialize();
  }

  // The getInfo method provides metadata about the extension,
  // including the blocks it adds to the editor.
  getInfo() {
    return {
      id: 'antiCheat',
      name: 'Anti-Cheat Protection',
      color1: '#8A2BE2',
      color2: '#9370DB',
      blocks: [
        {
          opcode: 'checkStatus',
          blockType: 'reporter',
          text: '反作弊状态', // Changed to Chinese for user-friendliness
          disableMonitor: true
        }
      ]
    };
  }

  // This is the function that the '反作弊状态' block will call.
  // It simply reports that the extension is active.
  checkStatus() {
    return 'Active';
  }

  // The initialization function sets up all the patches.
  initialize() {
    console.log('[Anti-Cheat] Initializing anti-cheat protection...');
    if (!this.vm || !this.vm.runtime || !this.vm.runtime.ccwAPI) {
      console.error('[Anti-Cheat] Scratch VM instance or APIs not available. Cannot initialize.');
      return;
    }
    this.patchDataModification();
    this.patchExtensionLoader();
    this.patchLeaderboardCalls();
  }

  // Patches the method used to modify project data.
  patchDataModification() {
    const originalMethod = this.vm.runtime.ccwAPI.setValueToProject;
    if (!originalMethod) {
      console.error('[Anti-Cheat] Could not find original setValueToProject method.');
      return;
    }

    this.patches.set('setValueToProject', originalMethod);

    // Override the original method with our patched version.
    this.vm.runtime.ccwAPI.setValueToProject = (target, key, value) => {
      const now = Date.now();

      // Implement a simple rate-limiting check.
      if (now - this.lastDataUpdateTime > 1000) {
        this.updateCount = 0;
        this.lastDataUpdateTime = now;
      }
      this.updateCount++;

      if (this.updateCount > this.updateThreshold) {
        // Detected too many updates in a short period, which is a strong
        // indicator of a cheat script. Block the operation.
        this.showWarning('高频数据修改被检测并阻止！'); // Changed to Chinese
        console.warn('[Anti-Cheat] Blocked high-frequency data modification:', {
          target,
          key,
          value
        });
        return;
      }
      
      console.log('[Anti-Cheat] Data modification allowed:', { key, value });

      // Call the original method to perform the actual update.
      return originalMethod.call(this.vm.runtime.ccwAPI, target, key, value);
    };
  }

  // Patches the extension loader to enforce security.
  patchExtensionLoader() {
    const originalMethod = this.vm.extensionManager.loadExtensionURL;
    if (!originalMethod) {
      console.error('[Anti-Cheat] Could not find original loadExtensionURL method.');
      return;
    }

    this.patches.set('loadExtensionURL', originalMethod);

    this.vm.extensionManager.loadExtensionURL = async (url) => {
      // Check if the URL is from a known, trusted source or an official extension.
      const isTrusted = url.includes('gandi-main.ccw.site') || url.includes('official-extensions.ccw.site');
      
      if (!isTrusted) {
        // Use a custom modal instead of `alert()` as it's not allowed in iframes.
        const userConfirmation = await this.showCustomConfirm(
          `警告: 您正在尝试加载来自非官方来源的扩展: \n${url}\n这可能包含恶意代码。您确定要继续吗？` // Changed to Chinese
        );
        
        if (!userConfirmation) {
          console.warn(`[Anti-Cheat] User blocked loading of untrusted extension: ${url}`);
          return Promise.reject(new Error('User cancelled extension loading.'));
        }
      }

      console.log(`[Anti-Cheat] Loading extension from: ${url}`);
      return originalMethod.call(this.vm.extensionManager, url);
    };
  }
  
  // Patches leaderboard-related API calls to validate data.
  patchLeaderboardCalls() {
    const originalMethod = this.vm.runtime.ccwAPI.insertLeaderboard;
    if (!originalMethod) {
      console.error('[Anti-Cheat] Could not find original insertLeaderboard method.');
      return;
    }
    
    this.patches.set('insertLeaderboard', originalMethod);
    
    this.vm.runtime.ccwAPI.insertLeaderboard = (leaderboardId, score, ext) => {
      // Perform basic sanity checks on the score.
      if (typeof score !== 'number' || score < 0 || score > 1000000) {
        this.showWarning(`检测到无效的分数值：${score}。排行榜提交被阻止。`); // Changed to Chinese
        console.warn('[Anti-Cheat] Blocked invalid leaderboard score submission:', {
          leaderboardId,
          score,
          ext
        });
        return;
      }
      
      console.log(`[Anti-Cheat] Leaderboard score submission allowed: ${score}`);
      return originalMethod.call(this.vm.runtime.ccwAPI, leaderboardId, score, ext);
    };
  }

  // Helper function to show a custom warning message.
  showWarning(message) {
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.padding = '20px';
    modal.style.backgroundColor = 'white';
    modal.style.border = '2px solid red';
    modal.style.borderRadius = '8px';
    modal.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    modal.style.zIndex = '10000';
    modal.style.fontFamily = 'sans-serif';
    
    const text = document.createElement('p');
    text.textContent = message;
    text.style.color = '#333';
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '确定'; // Changed to Chinese
    closeBtn.style.marginTop = '10px';
    closeBtn.style.padding = '5px 10px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => document.body.removeChild(modal);
    
    modal.appendChild(text);
    modal.appendChild(closeBtn);
    document.body.appendChild(modal);
  }

  // Helper function for a custom confirmation dialog.
  showCustomConfirm(message) {
    return new Promise(resolve => {
      const modal = document.createElement('div');
      modal.style.position = 'fixed';
      modal.style.top = '50%';
      modal.style.left = '50%';
      modal.style.transform = 'translate(-50%, -50%)';
      modal.style.padding = '20px';
      modal.style.backgroundColor = 'white';
      modal.style.border = '2px solid orange';
      modal.style.borderRadius = '8px';
      modal.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
      modal.style.zIndex = '10000';
      modal.style.fontFamily = 'sans-serif';

      const text = document.createElement('p');
      text.textContent = message;
      text.style.color = '#333';

      const confirmBtn = document.createElement('button');
      confirmBtn.textContent = '是'; // Changed to Chinese
      confirmBtn.style.marginRight = '10px';
      confirmBtn.style.padding = '5px 10px';
      confirmBtn.style.cursor = 'pointer';
      confirmBtn.onclick = () => {
        document.body.removeChild(modal);
        resolve(true);
      };

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = '否'; // Changed to Chinese
      cancelBtn.style.padding = '5px 10px';
      cancelBtn.style.cursor = 'pointer';
      cancelBtn.onclick = () => {
        document.body.removeChild(modal);
        resolve(false);
      };

      modal.appendChild(text);
      modal.appendChild(confirmBtn);
      modal.appendChild(cancelBtn);
      document.body.appendChild(modal);
    });
  }
}

// --- 以下是关键的注册代码 ---
// GandiIDE 扩展的正确注册方式
// Gandi IDE 会在 `window.ScratchExtensions` 下提供扩展注册方法。
(function() {
  const S = window.ScratchExtensions || {};
  if (S.register) {
    S.register(GandiAntiCheatExtension);
    console.log('[Anti-Cheat] Extension registered successfully.');
  } else {
    console.error('[Anti-Cheat] ScratchExtensions.register not found. Cannot register extension.');
  }
})();
