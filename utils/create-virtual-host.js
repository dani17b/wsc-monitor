const fs = require('fs-extra');
const rimraf = require('rimraf');
const { execSync } = require("child_process");

module.exports = async function createVirtualHost(domain, options) {
    // 1. Clean previous instalations
    rimraf.sync(`/var/www/${domain}`);
    rimraf.sync(`/etc/nginx/sites-enabled/${domain}`);

    // 2. Create virtual host
    fs.mkdirSync(`/var/www/${domain}`);
    console.log("Create virtual host", `/var/www/${domain}`);
    fs.chmodSync(`/var/www/${domain}`, 755);

    // 3. Link contents
    if(options.type == 'static'){
        fs.symlinkSync(`/home/apps/${options.name}/${options.target}`,`/var/www/${domain}/${options.target}`, `dir`);
    }

    // 4. Create virtual host config
    const sitesAvailableConf = getSitesAvailableConf(domain, options);
    fs.writeFileSync(
        `/etc/nginx/sites-available/${domain}`,
        sitesAvailableConf,
        'UTF-8'
    );
    
    // 5. Enable site
    fs.symlinkSync(`/etc/nginx/sites-available/${domain}`, `/etc/nginx/sites-enabled/${domain}`, `dir`);
    execSync(`systemctl restart nginx`);
};


const getSitesAvailableConf = (domain, options) => {
    const sitesAvailableConf = `
        server {
            listen 80;
            listen [::]:80;

            root /var/www/${domain}${options.type == 'static' ? ('/' + options.target) : ''};
            index index.html index.htm index.nginx-debian.html;

            server_name ${domain} www.${domain};

            location / {
                try_files $uri $uri/ =404;
            }
        }
    `;

    return sitesAvailableConf;
}