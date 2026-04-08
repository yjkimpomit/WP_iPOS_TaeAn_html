/**
 * 페이지에서 위치기능/계통/종류 트리 리스트
 * /common/facilityMasterList.jsp 연결
 */
$(document).ready(function () {
    function initializeZTree() {
        // 공통 zTree 설정: jsTree 포맷(id, parent, text) 매핑
        var setting = {
            view: {
                showIcon: false,
                nameIsHTML: true,
                selectedMulti: false
            },
            data: {
                key: {name: 'text'},
                simpleData: {
                    enable: true,
                    idKey: 'id',
                    pIdKey: 'parent',
                    rootPId: '#'
                }
            }
        };

        // 검색 디바운스 유틸
        var debounceTimer;

        function debounce(fn, wait) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(fn, wait);
        }

        // 트리 필터링 (퍼지 검색)
        function filterZTree(treeId, query) {
            var treeObj = $.fn.zTree.getZTreeObj(treeId);
            if (!treeObj) return;
            var allNodes = treeObj.transformToArray(treeObj.getNodes());
            treeObj.expandAll(false);
            allNodes.forEach(function (n) {
                treeObj.hideNode(n);
            });
            if (!query || query.length < 2) {
                allNodes.forEach(function (n) {
                    treeObj.showNode(n);
                });
                return;
            }
            var matched = treeObj.getNodesByParamFuzzy('text', query, null).concat(treeObj.getNodesByParamFuzzy('name', query, null));
            var handled = new Set();
            matched.forEach(function (n) {
                if (handled.has(n.tId)) return;
                handled.add(n.tId);
                treeObj.showNode(n);
                var p = n.getParentNode();
                while (p) {
                    treeObj.showNode(p);
                    treeObj.expandNode(p, true, false, false);
                    p = p.getParentNode();
                }
                var children = treeObj.transformToArray([n]);
                children.forEach(function (c) {
                    treeObj.showNode(c);
                });
            });
        }

        // 공통 초기화 함수: 데이터 로드 후 zTree 생성 및 검색 바인딩
        function initTree(treeSelector, inputSelector, url) {
            treeSelector = treeSelector + + packageTreeTabIdx;

            $.ajax({
                type: 'POST',
                url: url,
                dataType: 'json',
                success: function (data) {
                    var treeId = treeSelector.replace('#', '');
                    $.fn.zTree.init($(treeSelector), setting, data);

                    // 검색 이벤트 연결 (개별 input 전용)
                    if (inputSelector) {
                        $(inputSelector).off('keyup.' + treeId).on('keyup.' + treeId, function () {
                            var q = $(this).val();
                            debounce(function () {
                                filterZTree(treeId, q);
                            }, 250);
                        });
                    }
                }
            });
        }

        // 각 트리 초기화
        initTree('#facTree1', '#facTree1-input', '/common/facilityLocList.do');
        initTree('#facTree2', '#facTree2-input', '/common/facilitySysList.do');
        initTree('#facTree3', '#facTree3-input', '/common/facilityTypeList.do');
    }

    initializeZTree();
});
