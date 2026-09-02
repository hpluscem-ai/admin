import logo from '../assets/hayan100-logo.png'

/** 서비스와 사업자 정보를 표시하는 공용 푸터다. */
export function Footer() {
  return (
    <footer className="site-footer">
      <img className="site-footer__logo" src={logo} alt="HAYAN100" />
      <hr className="site-footer__divider" />
      <div className="site-footer__information">
        <p>이용약관</p>
        <p className="site-footer__privacy">개인정보처리방침</p>
        <div className="site-footer__customer-service">
          <p>고객센터</p>
          <p>전화번호 : 010-0000-0000</p>
          <p>주중 09~18시 (점심시간 12~13시 30분 / 주말 및 공휴일 제외)</p>
        </div>
      </div>
      <hr className="site-footer__divider" />
      <address className="site-footer__company">
        <p>에이치플러스에코</p>
        <p>사업자등록번호 : 220-86-00404</p>
        <p>대표 : 홍길동</p>
        <p>개인정보처리담당자 : 홍길동</p>
        <p>주소 : 서울시 송파구 석촌호수로 222 6~8층 (석촌동, 제이타워)</p>
        <p>Copyright © 2021 H-Plus Eco. All Rights Reserved.</p>
      </address>
    </footer>
  )
}
