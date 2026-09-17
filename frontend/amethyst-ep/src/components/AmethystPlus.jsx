import { useId } from 'react'
import './AmethystPlus.css'

// Coordinates trace the photograph; the viewBox trims the surrounding background.
const innerPath = 'M683 522 C895 645 1153 955 1131 1233 Q683 1506 239 1233 C223 949 469 653 683 522Z'
const nodes = [
  { id: 'business', label: 'Tickets', x: 682, y: 447, width: 104, height: 86 },
  { id: 'care', label: 'Roadmap', x: 145, y: 1276, width: 112, height: 114 },
  { id: 'sales', label: 'Team', x: 1223, y: 1277, width: 104, height: 112 },
]
const contours = [
  'M493 530 C549 580 582 550 580 583 C525 628 652 663 681 608 C708 560 597 568 608 530',
  'M470 564 C520 671 606 661 654 655 S724 659 753 694 S844 750 968 711',
  'M445 590 C505 664 604 702 671 693 S730 718 760 740 S871 740 929 750 S937 788 946 821 S1000 878 1070 886',
  'M420 612 C498 677 569 713 646 730 S748 776 800 786 S885 729 906 801 S946 875 1049 889',
  'M403 631 C520 683 627 753 715 791 S795 754 853 808 S913 879 950 898 S1032 903 1054 925 S1040 971 1026 951 C981 907 922 937 965 958 S1073 1043 1108 988',
  'M806 557 C735 583 804 674 873 650',
  'M977 744 C938 816 1016 859 1069 862',
  'M304 744 C403 773 421 830 508 834 S609 856 618 898',
  'M291 880 C391 872 475 832 544 867 S623 943 683 948 S802 1003 863 1052 S1018 1169 1082 1145 S1042 1062 1000 1043 S921 1030 894 1027 C803 1038 775 969 706 985 S593 1002 538 956',
  'M343 950 C352 920 411 945 418 972 C431 1031 377 1052 338 1020 S302 969 320 969 S335 973 343 950',
  'M662 1096 C736 1099 771 1154 829 1193 S963 1263 984 1295 S927 1347 877 1322 S794 1297 743 1281 S626 1244 602 1210 S593 1111 662 1096',
  'M657 1124 C713 1115 758 1176 811 1211 S902 1260 918 1270 C942 1293 911 1315 889 1288 S790 1256 745 1246 S639 1223 622 1193 S612 1138 657 1124',
  'M653 1154 C682 1148 722 1171 737 1194 S716 1213 704 1201 S674 1190 661 1175 S642 1159 653 1154',
  'M983 1191 C1025 1166 1050 1224 1015 1236 C978 1250 956 1208 983 1191',
  'M225 1211 C284 1276 310 1240 365 1274 S425 1310 448 1365',
]

/** Controlled navigation. value: business | care | sales | null. */
export default function AmethystPlus({ value, onChange }) {
  const id = useId().replace(/:/g, '')
  return (
    <div className="amethyst-plus" role="group" aria-label="Choose your AmethystPlus">
      <svg className="amethyst-badge" viewBox="0 320 1368 1260" aria-hidden="true">
        <defs>
          <clipPath id={`${id}-center`}><path d={innerPath} /></clipPath>
          <linearGradient id={`${id}-cream`} x2="0.8" y2="1"><stop stopColor="#f6f1dc" /><stop offset="0.55" stopColor="#eee9d6" /><stop offset="1" stopColor="#e7e1cd" /></linearGradient>
          <linearGradient id={`${id}-blue`} x2="1" y2="0.6"><stop stopColor="#123b91" /><stop offset="0.55" stopColor="#2447a3" /><stop offset="1" stopColor="#405eb3" /></linearGradient>
          <path id={`${id}-label`} d="M188 1329 Q684 1621 1180 1329" />
        </defs>
        <path d="M681 354 C881 445 1036 555 1174 830 C1285 1030 1342 1161 1319 1328 Q690 1744 41 1330 C18 1173 64 1030 165 822 C274 595 447 466 681 354Z" fill={`url(#${id}-cream)`} stroke="#527bcc" strokeWidth="7" />
        <path d={innerPath} fill={`url(#${id}-blue)`} stroke="#f8f1df" strokeWidth="3" />
        <g clipPath={`url(#${id}-center)`} fill="none" stroke="#b6a9c6" strokeWidth="2.6" opacity="0.72">
          {contours.map((d, index) => <path key={index} d={d} />)}
          <path d="M297 882 C453 809 437 696 527 752 S653 838 753 797 S857 738 870 651 M237 1100 C300 1131 398 1065 466 1147 S507 1322 657 1322 S801 1328 872 1355" strokeWidth="6" strokeDasharray="21 22" />
        </g>
        <g fill="#f5f0dc" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" textAnchor="middle" fontSize="151" letterSpacing="-4">
          <text x="684" y="993">Amethyst</text><text x="684" y="1128">Plus</text>
        </g>
        <text fill="#625e5c" fontFamily="Georgia, 'Times New Roman', serif" fontSize="80" textAnchor="middle" letterSpacing="-2">
          <textPath href={`#${id}-label`} startOffset="50%">Scheduling Hub</textPath>
        </text>
      </svg>
      {nodes.map((node) => (
        <button key={node.id} type="button" className={`path-node${value === node.id ? ' is-selected' : ''}`}
          style={{ left: `${node.x / 1368 * 100}%`, top: `${(node.y - 320) / 1260 * 100}%`, width: `${node.width / 1368 * 100}%`, height: `${node.height / 1260 * 100}%` }}
          aria-label={node.label} aria-pressed={value === node.id} onClick={() => onChange(value === node.id ? null : node.id)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            {value === node.id ? <path d="m5 12 4 4L19 6" /> : <path d="M6 12h12m-5-5 5 5-5 5" />}
          </svg>
          <span className="node-tooltip">{node.label}</span>
        </button>
      ))}
    </div>
  )
}
