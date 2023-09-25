let accounts;

// METAMASK CONNECTION
window.addEventListener("DOMContentLoaded", async () => {

  if (window.ethereum) {
    window.web3 = new Web3(window.ethereum);
    checkChain();
  } else if (window.web3) {
    window.web3 = new Web3(window.web3.currentProvider);
  }

  if (window.web3) {
    // Check if User is already connected by retrieving the accounts
    await window.web3.eth.getAccounts().then(async (addr) => {
      accounts = addr;
    });
  }

  updateConnectStatus();
  if (MetaMaskOnboarding.isMetaMaskInstalled()) {
    window.ethereum.on("accountsChanged", (newAccounts) => {
      accounts = newAccounts;
      updateConnectStatus();
    });
  }
});

const updateConnectStatus = async () => {
  const onboarding = new MetaMaskOnboarding();
  const onboardButton = document.getElementById("connectWallet");
  if (!MetaMaskOnboarding.isMetaMaskInstalled()) {
    onboardButton.innerText = "Install MetaMask";
    onboardButton.onclick = () => {
      onboardButton.innerText = "Connecting...";
      onboardButton.disabled = true;
      onboarding.startOnboarding();
    };
  } else if (accounts && accounts.length > 0) {
    onboardButton.innerText = `✔ ...${accounts[0].slice(-4)}`;
    window.address = accounts[0];
    onboardButton.disabled = true;
    onboarding.stopOnboarding();
    window.contract = new web3.eth.Contract(abi, contractAddress);
    loadInfo();
    window.location.reload();
  } else {
    onboardButton.innerText = "Connect MetaMask";
    onboardButton.onclick = async () => {
      await window.ethereum
        .request({
          method: "eth_requestAccounts",
        })
        .then(function (accts) {
          onboardButton.innerText = `✔ ...${accts[0].slice(-4)}`;
          onboardButton.disabled = true;
          window.address = accts[0];
          accounts = accts;
          window.contract = new web3.eth.Contract(abi, contractAddress);
          loadInfo();
        });
    };
  }
};

async function checkChain() {
  let chainId = 0;
  if(chain === 'goerli') {
    chainId = 5;
  } else if(chain === 'polygon') {
    chainId = 137;
  } else if(chain === 'ethereum') {
    chainId = 1;
  }
  if (window.ethereum.networkVersion !== chainId) {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: web3.utils.toHex(chainId) }],
      });
      updateConnectStatus();
    } catch (err) {
        // This error code indicates that the chain has not been added to MetaMask.
      if (err.code === 4902) {
        try {
          if(chain === 'goerli') {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainName: 'Goerli Test Network',
                  chainId: web3.utils.toHex(chainId),
                  nativeCurrency: { name: 'ETH', decimals: 18, symbol: 'ETH' },
                  rpcUrls: ['https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'],
                },
              ],
            });
          } else if(chain === 'polygon') {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainName: 'Polygon Mainnet',
                  chainId: web3.utils.toHex(chainId),
                  nativeCurrency: { name: 'MATIC', decimals: 18, symbol: 'MATIC' },
                  rpcUrls: ['https://polygon-rpc.com/'],
                },
              ],
            });
          }
          updateConnectStatus();
        } catch (err) {
          console.log(err);
        }
      }
    }
  }
}

async function loadInfo() {
  window.info = await window.contract.methods.getInfo().call();
  const publicMintActive = await contract.methods.mintingActive().call();
  const presaleMintActive = await contract.methods.presaleActive().call();
  const mainHeading = document.getElementById("mainHeading");
  const subHeading = document.getElementById("subHeading");
  const mainText = document.getElementById("mainText");
  const mintContainer = document.getElementById("mintContainer");
  const mintButton = document.getElementById("mintButton");
  mintButton.style.visibility = "visible";
  mainText.style.fontWeight = "bold";


  let startTime = "";
  if (publicMintActive) {
    mainHeading.innerText = h1_public_mint;
    mainText.innerText = p_public_mint;
    mintButton.innerText = button_public_mint;
    setTotalPrice(publicMintActive);
  } else if (presaleMintActive) {
    startTime = window.info.runtimeConfig.publicMintStart;
    mainHeading.innerText = h1_presale_mint;
    //subHeading.innerText = h2_presale_mint;
    
    try {
      // CHECK IF WHITELISTED
      const merkleData = await fetch(
        `/.netlify/functions/merkleProof/?wallet=${window.address}&chain=${chain}&contract=${contractAddress}`
      );
      const merkleJson = await merkleData.json();
      const whitelisted = await contract.methods.isWhitelisted(window.address, merkleJson).call();
 
      if(!whitelisted) {
        mainText.innerText = p_presale_mint_not_whitelisted;
        mintButton.disabled = true;
        mintButton.hidden = true;
        mintButton.style.visibility = "hidden";
      } else {
        mainText.innerText = p_presale_mint_whitelisted;
        mintButton.innerText = button_presale_mint_whitelisted;
      }
    } catch(e) {
      mainText.innerText = p_presale_mint_already_minted;
      mintButton.disabled = true;
      mintButton.hidden = true;
    }
    setTotalPrice(publicMintActive);
  } else {
    startTime = window.info.runtimeConfig.presaleMintStart;
    mainHeading.innerText = h1_presale_coming_soon;
    subHeading.innerText = h2_presale_coming_soon;
    mainText.innerText = p_presale_coming_soon;
  }

  let priceType = '';
  if(chain === 'goerli' || chain === 'ethereum') {
    priceType = 'ETH';
  } else if (chain === 'polygon') {
    priceType = 'MATIC';
  }

  const pricePerMint = document.getElementById("pricePerMint");
  const totalSupply = document.getElementById("totalSupply");
  const mintInput = document.getElementById("mintInput");

  if (publicMintActive){
    const publicsalePrice = web3.utils.fromWei(info.runtimeConfig.publicMintPrice, 'ether');
    pricePerMint.innerText = `${publicsalePrice} ${priceType}`;
  }
  else {
    const presalePrice = web3.utils.fromWei(info.runtimeConfig.presaleMintPrice, 'ether');
    pricePerMint.innerText = `${presalePrice} ${priceType}`;
  }  


  totalSupply.innerText = await contract.methods.totalSupply().call() + "/" + `${info.deploymentConfig.maxSupply}`;
  mintInput.setAttribute("max", info.deploymentConfig.tokensPerMint);

  // MINT INPUT
  const mintIncrement = document.getElementById("mintIncrement");
  const mintDecrement = document.getElementById("mintDecrement");
  const setQtyMax = document.getElementById("setQtyMax");
  const min = mintInput.attributes.min.value || false;
  const max = mintInput.attributes.max.value || false;
  mintDecrement.onclick = () => {
    let value = parseInt(mintInput.value) - 1 || 1;
    if(!min || value >= min) {
      mintInput.value = value;
      setTotalPrice(publicMintActive)
    }
  };
  mintIncrement.onclick = () => {
    let value = parseInt(mintInput.value) + 1 || 1;
    if(!max || value <= max) {
      mintInput.value = value;
      setTotalPrice(publicMintActive)
    }
  };
  setQtyMax.onclick = () => {
    mintInput.value = max;
    setTotalPrice(publicMintActive)
  };
  mintInput.onchange = () => {
    setTotalPrice(publicMintActive)
  };
  mintInput.onkeyup = async (e) => {
    if (e.keyCode === 13) {
      mint();
    }
  };
  mintButton.onclick = mint;
}

function setTotalPrice(publicMintActive) {
  const mintInput = document.getElementById("mintInput");
  const mintInputValue = parseInt(mintInput.value);
  const totalPrice = document.getElementById("totalPrice");
  const mintButton = document.getElementById("mintButton");
  if(mintInputValue < 1 || mintInputValue > info.deploymentConfig.tokensPerMint) {
    totalPrice.innerText = 'INVALID QUANTITY';
    mintButton.disabled = true;
    mintInput.disabled = true;
    return;
  }
 
  let priceType = '';
  if(chain === 'goerli' || chain === 'ethereum') {
    priceType = 'ETH';
  } else if (chain === 'polygon') {
    priceType = 'MATIC';
  }
  
  if (publicMintActive){
    const publicSaletotalPriceWei = BigInt(info.runtimeConfig.publicMintPrice) * BigInt(mintInputValue);
    const publicSaleprice = web3.utils.fromWei(publicSaletotalPriceWei.toString(), 'ether');
    totalPrice.innerText = `${publicSaleprice} ${priceType}`;
  }  
  else{
    const preSaletotalPriceWei = BigInt(info.runtimeConfig.presaleMintPrice) * BigInt(mintInputValue);
    const preSaleprice = web3.utils.fromWei(preSaletotalPriceWei.toString(), 'ether');
    totalPrice.innerText = `${preSaleprice} ${priceType}`;
  }
  
  mintButton.disabled = false;
  mintInput.disabled = false;
}

async function mint() {
  const publicMintActive = await contract.methods.mintingActive().call();
  const presaleMintActive = await contract.methods.presaleActive().call();
  const mintButton = document.getElementById("mintButton");
  const mainText = document.getElementById("mainText");
  mintButton.disabled = true;
  const spinner = '<div class="dot-elastic"></div><span>Waiting for transaction...</span>';
  mintButton.innerHTML = spinner;
  const amount = parseInt(document.getElementById("mintInput").value);

  if (publicMintActive) {
    // PUBLIC MINT
    const publicSaleValue = BigInt(info.runtimeConfig.publicMintPrice) * BigInt(amount);
    try {
      const mintTransaction = await contract.methods
        .mint(amount)
        .send({ from: window.address, value: publicSaleValue.toString() });
      if(mintTransaction) {
        if(chain == 'goerli') {
          const url = "https://goerli.etherscan.io/tx/" + mintTransaction.transactionHash;
          mainText.innerText = "Minted successfully!";
          mintButton.innerText = button_public_mint;
        }
      } else {
        mainText.innerText = mint_failed;
        mintButton.innerText = button_public_mint;
        mintButton.disabled = false;

        console.log("Failed to mint!");
      }
    } catch(e) {
      const mainText = document.getElementById("mainText");
      console.log(e);
      mainText.innerText = mint_failed;
      mintButton.innerText = button_public_mint;
      mintButton.disabled = false;
    }
  } else if (presaleMintActive) {
        // PRE-SALE MINTING
        const preSaleValue = BigInt(info.runtimeConfig.presaleMintPrice) * BigInt(amount);
    try {
      const merkleData = await fetch(
        `/.netlify/functions/merkleProof/?wallet=${window.address}&chain=${chain}&contract=${contractAddress}`
      );
      const merkleJson = await merkleData.json();
      const whitelisted = await contract.methods.isWhitelisted(window.address, merkleJson).call();
      if(!whitelisted)
      {
        mintButton.innerText = button_public_mint;
        mintButton.style.visibility = "hidden";
        return;
      }
      const presaleMintTransaction = await contract.methods
        .presaleMint(amount, merkleJson)
        .send({ from: window.address, value: preSaleValue.toString() });
      if(presaleMintTransaction) {
        if(chain === 'goerli') {
          const url = "https://goerli.etherscan.io/tx/" + mintTransaction.transactionHash;
          mainText.innerText = "Minted successfully!";
          mintButton.innerText = button_public_mint;
        }

      } else {
        const mainText = document.getElementById("mainText");
        mainText.innerText = mint_failed;
        mintButton.innerText = button_presale_mint_whitelisted;
        mintButton.disabled = false;
      }
    } catch(e) {
      const mainText = document.getElementById("mainText");
      mainText.innerText = mint_failed;
      mintButton.innerText = button_presale_mint_whitelisted;
      mintButton.disabled = false;
    }
  }
}
