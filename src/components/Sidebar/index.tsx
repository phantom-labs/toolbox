import React, { useState } from 'react';
import styled from 'styled-components';

import { DARK_GRAY, GRAY, LIGHT_GRAY, PURPLE, REACT_GRAY, WHITE } from '../../constants';
import { hexToRGB } from '../../utils';
import Button from '../Button';
import { ConnectedAccounts, ConnectedMethods } from '../../App';
import { SupportedChainIcons, SupportedEVMChainIds } from '../../types';
import { TabPanel, TabPanels, Tabs } from '@chakra-ui/react';
import { Select, chakraComponents } from 'chakra-react-select';
import { css } from '@emotion/react';

// =============================================================================
// Styled Components
// =============================================================================

const Main = styled.main`
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px;
  align-items: center;
  background-color: ${REACT_GRAY};
  box-sizing: border-box;
  height: 100vh;
  max-height: 100vh;
  padding-bottom: 46px;

  > * {
    margin-bottom: 10px;
  }

  @media (max-width: 768px) {
    width: 100%;
    height: auto;
    flex: 1;
    position: unset;
    max-height: auto;
    overflow: scroll;
  }
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  flex: 1;
  max-height: 100%;

  button {
    margin-bottom: 15px;
  }
`;

const Link = styled.a.attrs({
  href: 'https://phantom.app/',
  target: '_blank',
  rel: 'noopener noreferrer',
})`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-decoration: none;
  margin-bottom: 15px;
  // margin-bottom: 30px;
  padding: 5px;

  &:focus-visible {
    outline: 2px solid ${hexToRGB(GRAY, 0.5)};
    border-radius: 6px;
  }
`;

const Subtitle = styled.h5`
  color: ${GRAY};
  font-weight: 400;
`;

const Pre = styled.pre`
  margin-bottom: 5px;
  margin-right: auto;
`;

const AccountRow = styled.div`
  display: flex;
  margin-bottom: 8px;

  :last-of-type {
    margin-bottom: 0;
  }
`;

const Badge = styled.div`
  margin: 0;
  padding: 10px;
  width: 100%;
  color: ${PURPLE};
  background-color: ${hexToRGB(PURPLE, 0.2)};
  font-size: 14px;
  border-radius: 0 6px 6px 0;
  @media (max-width: 400px) {
    width: 280px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  @media (max-width: 320px) {
    width: 220px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  ::selection {
    color: ${WHITE};
    background-color: ${hexToRGB(PURPLE, 0.5)};
  }

  ::-moz-selection {
    color: ${WHITE};
    background-color: ${hexToRGB(PURPLE, 0.5)};
  }
`;

const Divider = styled.div`
  border: 1px solid ${DARK_GRAY};
  height: 1px;
  margin: 20px 0;
`;

const Tag = styled.p`
  text-align: center;
  color: ${GRAY};

  a {
    color: ${PURPLE};
    text-decoration: none;

    ::selection {
      color: ${WHITE};
      background-color: ${hexToRGB(PURPLE, 0.5)};
    }

    ::-moz-selection {
      color: ${WHITE};
      background-color: ${hexToRGB(PURPLE, 0.5)};
    }
  }

  @media (max-width: 320px) {
    font-size: 14px;
  }

  ::selection {
    color: ${WHITE};
    background-color: ${hexToRGB(PURPLE, 0.5)};
  }

  ::-moz-selection {
    color: ${WHITE};
    background-color: ${hexToRGB(PURPLE, 0.5)};
  }
`;

const Toggle = styled.button`
  cursor: pointer;
  width: 100%;
  color: ${WHITE};
  background-color: ${DARK_GRAY};
  // padding: 15px 10px;
  font-weight: 600;
  outline: 0;
  border: 0;
  // border-radius: 6px;
  user-select: none;
  // display: flex;
  // align-items: center;
  // justify-content: center;
  // position: relative;
  &:hover {
    background-color: ${hexToRGB(LIGHT_GRAY, 0.9)};
  }

  &:focus-visible &:not(:hover) {
    background-color: ${hexToRGB(LIGHT_GRAY, 0.8)};
  }

  &:active {
    background-color: ${LIGHT_GRAY};
  }
`;

const ChainIcon = styled.img`
  height: ${(props) => props.height};
  width: ${(props) => props.height};
  border-radius: 6px 0 0 6px;
`;

const ChainHeader = styled.div`
  display: flex;
  width: 100%;
  justify-content: flex-start;
  align-items: center;
  margin: 5px 0 10px;
`;

const ButtonRow = styled.div`
  display: flex;
  width: 100%;
  justify-content: center;
  align-items: center;
  gap: 16px;
`;

// =============================================================================
// Typedefs
// =============================================================================

interface Props {
  connectedMethods: ConnectedMethods;
  connectedEthereumChainId: SupportedEVMChainIds | null;
  connectedAccounts: ConnectedAccounts;
  connect: () => Promise<void>;
}

// =============================================================================
// Main Component
// =============================================================================
const Sidebar = React.memo((props: Props) => {
  const [tabIndex, setTabIndex] = useState(0);

  function renderConnectedMethods(methods, chainId) {
    return methods.map((method, i) => {
      const { name, args = {} } = method;

      if (Array.isArray(method)) {
        return <ButtonRow>{renderConnectedMethods(method, chainId)}</ButtonRow>;
      }

      return (
        <Button
          data-testid={`${chainId}-${name.toLowerCase().replace(/ /g, '-')}`}
          key={`${name}-${i}`}
          onClick={() => method.onClick({ chainId, ...args })}
        >
          {name}
        </Button>
      );
    });
  }

  const { connectedAccounts, connectedEthereumChainId, connectedMethods, connect } = props;

  const dropdownOptions = Object.keys(connectedMethods).map((key, index) => ({
    value: index,
    label: connectedMethods[key].name,
    icon: connectedMethods[key].icon,
  }));
  return (
    <Main>
      <Body>
        <Link>
          <img src="https://phantom.app/img/phantom-logo.svg" alt="Phantom" width="200" />
          <Subtitle>Multi-chain Sandbox</Subtitle>
        </Link>
        {connectedAccounts?.solana ? (
          // connected
          <>
            <div>
              <Pre>Connected as</Pre>
              <AccountRow>
                <ChainIcon src={SupportedChainIcons.Ethereum} height="36px" />
                <Badge data-testid="account-0x1">{connectedAccounts?.ethereum}</Badge>
              </AccountRow>
              <AccountRow>
                <ChainIcon src={SupportedChainIcons.Polygon} height="36px" />
                <Badge data-testid="account-0x137">{connectedAccounts?.ethereum}</Badge>
              </AccountRow>
              <AccountRow>
                <ChainIcon src={SupportedChainIcons.Solana} height="36px" />
                <Badge data-testid="account-0x100">{connectedAccounts?.solana?.toBase58()}</Badge>
              </AccountRow>
              <Divider />
            </div>

            <Select
              data-testid="chain_switcher-select"
              defaultValue={dropdownOptions[0]}
              chakraStyles={{
                container: (provided, state) => ({
                  ...provided,
                  width: '100%',
                }),
                dropdownIndicator: (provided, state) => ({
                  ...provided,
                  background: '#8A81F8',
                }),
              }}
              onChange={({ value }) => {
                setTabIndex(value as unknown as number);
              }}
              options={dropdownOptions}
              components={{
                Option: ({ children, ...props }) => (
                  <chakraComponents.Option
                    {...props}
                    data-testid={`chain_switcher-option-${props.label.toLowerCase().replace(/ /g, '-')}`}
                  >
                    <ChainHeader>
                      <ChainIcon
                        src={props.data.icon}
                        height="16px"
                        style={{ marginRight: '6px', borderRadius: '6px' }}
                      />
                      <Tag style={{ textAlign: 'left', marginLeft: 4, lineHeight: '18px' }}>{props.label}</Tag>
                    </ChainHeader>
                  </chakraComponents.Option>
                ),
              }}
            />

            <Tabs index={tabIndex}>
              <TabPanels
                css={css`
                  width: 100%;
                `}
              >
                {Object.keys(connectedMethods).map((key) => (
                  <TabPanel
                    css={css`
                      padding: 16px 0 0 0;
                    `}
                  >
                    {renderConnectedMethods(connectedMethods[key].methods, key)}
                  </TabPanel>
                ))}
              </TabPanels>
            </Tabs>
          </>
        ) : (
          // not connected
          <Button data-testid="connect-to-phantom" onClick={connect} style={{ marginTop: '15px' }}>
            Connect to Phantom
          </Button>
        )}
      </Body>
      {/* 😊 💕  */}
      <Tag>
        Made with{' '}
        <span role="img" aria-label="Red Heart Emoji">
          ❤️
        </span>{' '}
        by the <a href="https://phantom.app">Phantom</a> team
      </Tag>
    </Main>
  );
});

export default Sidebar;
